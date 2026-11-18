#!/usr/bin/env python3
"""Tests for scores.py. Run: python3 -m unittest test_scores (from this folder)."""
import os
import sys
import tempfile
import unittest
import unittest.mock
from datetime import date

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import film_store as fs
import scores

MONDAY, TUESDAY = date(2026, 10, 5), date(2026, 10, 6)
LB_PAGE = '<script>{"aggregateRating":{"bestRating":5,"ratingValue":4.13,"ratingCount":9}}</script>'
RT_PAGE = '"criticsScore":{"certified":true,"score":"98"},"audienceScore":{"score":"86"}'
WIKIDATA = '{"entities":{"Q1":{"claims":{"P1258":[{"mainsnak":{"datavalue":{"value":"m/get_out"}}}]}}}}'


class ScoresTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.store = fs.Store(os.path.join(self.tmp.name, 'Films'))
        self.logs = []

    def tearDown(self):
        self.tmp.cleanup()

    def film(self, title, tmdb_id, created, **kw):
        film = self.store.upsert(title, 2020, tmdb_id=tmdb_id, today=created, **kw)
        film.save()
        return film

    def refresh(self, look, today):
        return scores.refresh(self.store, look, today=today, log=self.logs.append)

    def test_pages_are_parsed(self):
        pages = {'https://letterboxd.com/tmdb/1/': LB_PAGE, 'https://www.wikidata.org/wiki/Special:EntityData/Q1.json': WIKIDATA,
                 'https://www.rottentomatoes.com/m/get_out': RT_PAGE}
        pages['https://www.omdbapi.com/?i=tt1:key'.replace(':key', '&apikey=k')] = '{"imdbRating": "7.7"}'
        with unittest.mock.patch.dict(os.environ, {'OMDB_API_KEY': 'k'}):
            got = scores.lookup(1, tmdb=lambda path: {'wikidata_id': 'Q1', 'imdb_id': 'tt1'}, fetch=lambda url: pages.get(url, ''))
        self.assertEqual(got, {'lb': 4.13, 'rt': 98, 'aud': 86, 'rt_url': 'https://www.rottentomatoes.com/m/get_out',
                               'imdb': 7.7, 'imdb_url': 'https://www.imdb.com/title/tt1/'})

    def test_imdb_without_a_key_gives_the_link_only(self):
        self.assertEqual(scores.imdb(1, lambda p: {'imdb_id': 'tt1'}, fetch=lambda url: 1 / 0, key=''), (None, 'https://www.imdb.com/title/tt1/'))
        self.assertEqual(scores.imdb(1, lambda p: {'imdb_id': 'tt1'}, fetch=lambda url: '{"imdbRating": "N/A"}', key='k')[0], None)

    def test_a_stored_rt_url_skips_the_wikidata_lookup(self):
        asked = []
        scores.lookup(1, 'https://www.rottentomatoes.com/m/get_out', tmdb=lambda p: asked.append(p), fetch=lambda url: '')
        self.assertEqual(asked, ['/movie/1/external_ids'])      # only for the IMDb id; no Wikidata call

    def test_unreadable_pages_give_none_not_an_error(self):
        self.assertEqual(scores.lookup(1, tmdb=lambda p: None, fetch=lambda url: ''), {'lb': None, 'rt': None, 'aud': None, 'rt_url': None, 'imdb': None, 'imdb_url': None})
        self.assertEqual(scores.lookup(1, tmdb=lambda p: {'wikidata_id': 'Q1'}, fetch=lambda url: 'not json')['rt_url'], None)

    def test_only_films_whose_score_day_is_today_are_refreshed(self):
        mon = self.film('Monday Film', 1, MONDAY.isoformat())
        tue = self.film('Tuesday Film', 2, TUESDAY.isoformat())
        asked = []
        look = lambda i, u: asked.append(i) or {'lb': 3.5, 'rt': 70, 'aud': 60, 'rt_url': 'https://rt/x'}
        self.assertEqual(self.refresh(look, MONDAY), (1, 1))
        self.assertEqual(asked, [1])
        self.assertEqual((mon.fm['lb_rating'], mon.fm['rt_score'], mon.fm['rt_audience'], mon.fm['scores_checked']), (3.5, 70, 60, '2026-10-05'))
        self.assertNotIn('lb_rating', tue.fm)

    def test_running_again_the_same_day_asks_nothing(self):
        self.film('Monday Film', 1, MONDAY.isoformat())
        asked = []
        look = lambda i, u: asked.append(i) or {'lb': 3.5, 'rt': None, 'aud': None, 'rt_url': None}
        self.refresh(look, MONDAY)
        self.refresh(look, MONDAY)
        self.assertEqual(asked, [1])

    def test_a_failed_scrape_keeps_the_old_values_and_the_film_waits_a_week(self):
        film = self.film('Monday Film', 1, MONDAY.isoformat())
        self.store.set_scores(film, lb=4.0, rt=90, aud=80, today='2026-09-28')
        film.save()
        self.refresh(lambda i, u: {'lb': None, 'rt': None, 'aud': None, 'rt_url': None}, MONDAY)
        self.assertEqual((film.fm['lb_rating'], film.fm['rt_score'], film.fm['rt_audience'], film.fm['scores_checked']), (4.0, 90, 80, '2026-09-28'))

    def test_one_film_raising_does_not_stop_the_others(self):
        self.film('Bad', 1, MONDAY.isoformat())
        good = self.film('Good', 2, MONDAY.isoformat())

        def look(i, u):
            if i == 1:
                raise ValueError('boom')
            return {'lb': 3.0, 'rt': None, 'aud': None, 'rt_url': None}
        self.assertEqual(self.refresh(look, MONDAY), (2, 1))
        self.assertEqual(good.fm['lb_rating'], 3.0)

    def test_tv_and_id_less_films_are_skipped(self):
        self.film('Show', 5, MONDAY.isoformat(), tmdb_type='tv')
        self.film('No Id', None, MONDAY.isoformat())
        self.assertEqual(self.refresh(lambda i, u: self.fail('should not be asked'), MONDAY), (0, 0))

    def test_a_change_made_to_the_note_during_the_scrape_survives(self):
        self.film('Monday Film', 1, MONDAY.isoformat())

        def look(i, u):                                         # meanwhile the dashboard flags it and the poll adds a watch
            other = fs.Store(self.store.folder)
            film = other.find(tmdb_id=1)
            other.set_pending(film, True, '2026-10-05')
            other.add_watch(film, '2026-10-05', rating=8, guid='77')
            film.save()
            return {'lb': 3.5, 'rt': 70, 'aud': 60, 'rt_url': 'https://rt/x'}
        self.assertEqual(self.refresh(look, MONDAY), (1, 1))
        f = fs.Store(self.store.folder).find(tmdb_id=1)
        self.assertEqual((f.fm['lb_rating'], f.fm['rt_score'], f.fm['scores_checked']), (3.5, 70, '2026-10-05'))
        self.assertEqual((f.fm['pending'], f.fm['watches'], f.fm['ratings']), (True, ['2026-10-05'], [8]))
        self.assertIn('### 2026-10-05', f.body)


    def test_a_note_caught_mid_write_is_not_replaced_by_a_stub(self):
        film = self.film('Monday Film', 1, MONDAY.isoformat())

        def look(i, u):                                         # Obsidian has truncated the note and not yet written it
            open(film.path, 'w').close()
            return {'lb': 3.5, 'rt': 70, 'aud': 60, 'rt_url': 'https://rt/x'}
        self.assertEqual(self.refresh(look, MONDAY), (1, 0))
        self.assertEqual(os.path.getsize(film.path), 0)
        self.assertNotIn('lb_rating', film.fm)

    def test_a_note_deleted_during_the_scrape_is_not_recreated(self):
        film = self.film('Monday Film', 1, MONDAY.isoformat())

        def look(i, u):
            os.remove(film.path)
            return {'lb': 3.5, 'rt': 70, 'aud': 60, 'rt_url': 'https://rt/x'}
        self.assertEqual(self.refresh(look, MONDAY), (1, 0))
        self.assertFalse(os.path.exists(film.path))


if __name__ == '__main__':
    unittest.main()
