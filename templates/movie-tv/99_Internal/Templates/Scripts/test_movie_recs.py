#!/usr/bin/env python3
"""Tests for movie_recs.py's film-store glue. Run: python3 -m unittest test_movie_recs (from this folder).

Every test works in a temporary vault: movie_recs' module globals are patched and tmdb is a fake.
"""
import contextlib
import io
import os
import sys
import tempfile
import unittest
from datetime import date

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import film_store as fs
import movie_recs as mr

CREDITS = {'cast': [{'id': 1, 'name': 'Daniel Kaluuya', 'character': 'Chris', 'order': 0}], 'crew': []}


def fake_tmdb(path, **params):
    return CREDITS if path.endswith('/credits') else None


def card(title='Get Out', year=2017, tmdb_id=419430, url='https://letterboxd.com/film/get-out/'):
    return {'title': title, 'year': year, 'tmdb_id': tmdb_id, 'letterboxd_url': url, 'poster': 'https://img/p.jpg',
            'lb_rating': 4.1, 'rt_score': 98, 'rt_audience': 86, 'rt_url': 'https://www.rottentomatoes.com/m/get_out'}


class MovieRecsTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.saved = mr.VAULT, mr.FILMS, mr._STORE, mr.tmdb, fs.LOCK_FILE
        fs.LOCK_FILE = os.path.join(self.tmp.name, 'state', 'films.lock')
        mr.VAULT = self.tmp.name
        mr.FILMS = os.path.join(self.tmp.name, '50_Personal/Letterboxd/Films')
        mr._STORE = None
        mr.tmdb = fake_tmdb

    def tearDown(self):
        mr.VAULT, mr.FILMS, mr._STORE, mr.tmdb, fs.LOCK_FILE = self.saved
        self.tmp.cleanup()

    def record(self, cards, key, day):
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            mr.record_films(cards, key, day)
        return out.getvalue()

    def on_disk(self):
        return fs.Store(mr.FILMS)

    def fixture(self, build):
        """Build notes through a separate Store, then make mr.store() load them from disk."""
        st = fs.Store(mr.FILMS)
        build(st)
        mr._STORE = None

    def test_record_films_writes_one_note_per_card_with_day_scores_and_slug(self):
        self.record([card(), card('Us', 2019, 458723, 'https://letterboxd.com/film/us-2019/')], 'recommended', '2026-10-08')
        store = self.on_disk()
        self.assertEqual(len(store.films), 2)
        f = store.find(tmdb_id=419430).fm
        self.assertEqual(f['recommended'], ['2026-10-08'])
        self.assertEqual((f['lb_rating'], f['rt_score'], f['rt_audience'], f['rt_url']),
                         (4.1, 98, 86, 'https://www.rottentomatoes.com/m/get_out'))
        self.assertEqual(f['letterboxd_slug'], 'get-out')
        self.assertEqual(store.find(tmdb_id=458723).fm['letterboxd_slug'], 'us-2019')

    def test_the_same_film_suggested_on_another_day_reuses_its_note(self):
        self.record([card()], 'recommended', '2026-10-09')
        self.record([card()], 'recommended', '2026-10-08')
        store = self.on_disk()
        self.assertEqual(len(store.films), 1)
        self.assertEqual(store.films[0].fm['recommended'], ['2026-10-08', '2026-10-09'])

    def test_upcoming_fills_upcoming_and_not_recommended(self):
        self.record([card()], 'upcoming', '2026-10-05')
        f = self.on_disk().films[0].fm
        self.assertEqual((f['upcoming'], f['recommended']), (['2026-10-05'], []))

    def test_a_bad_card_warns_and_does_not_raise(self):
        bad = card()
        del bad['title']
        out = self.record([bad], 'recommended', '2026-10-08')
        self.assertTrue(out.startswith('warning: film notes not updated'), out)

    def test_load_queue_splits_on_the_pending_and_watchlist_flags(self):
        def build(st):
            for title, tmdb, listed, pending in (('Pending Only', 1, False, True), ('List Only', 2, True, False),
                                                 ('Both', 3, True, True), ('Neither', 4, False, False)):
                film = st.upsert(title, 2020, tmdb_id=tmdb)
                st.set_watchlist(film, listed, '2026-01-02')
                st.set_pending(film, pending, '2026-03-04')
                film.save()
        self.fixture(build)
        want, listed = mr.load_queue('want'), mr.load_queue('watchlist')
        self.assertEqual(sorted(r['title'] for r in want), ['Both', 'Pending Only'])
        self.assertEqual([r['title'] for r in listed], ['List Only'])
        for r in want + listed:
            self.assertEqual(set(r), {'title', 'year', 'source', 'tmdb_id', 'url', 'poster', 'added'})
        self.assertEqual({r['added'] for r in want}, {'2026-03-04'})
        self.assertEqual((listed[0]['added'], listed[0]['source'], listed[0]['tmdb_id']), ('2026-01-02', 'watchlist', 2))

    def test_load_diary_has_one_row_per_viewing(self):
        def build(st):
            film = st.upsert('Get Out', 2017, tmdb_id=419430)
            st.add_watch(film, '2019-03-02', rating=8, guid='1')
            st.add_watch(film, '2024-10-01', rating=9, guid='2')
            film.save()
        self.fixture(build)
        rows = mr.load_diary()
        self.assertEqual([(r['watched'], r['rating'], r['tmdb_id'], r['title']) for r in rows],
                         [('2019-03-02', 8, 419430, 'Get Out'), ('2024-10-01', 9, 419430, 'Get Out')])

    def test_record_films_reads_the_notes_again_so_a_change_since_the_first_load_survives(self):
        self.record([card()], 'recommended', '2026-10-07')
        mr._STORE = None
        mr.store()                                              # what `write` does long before it records its picks
        other = fs.Store(mr.FILMS)                              # meanwhile the poll logs a watch
        film = other.find(tmdb_id=419430)
        other.add_watch(film, '2026-10-07', rating=9, guid='55')
        film.save()
        self.record([card()], 'recommended', '2026-10-08')
        f = self.on_disk().find(tmdb_id=419430).fm
        self.assertEqual((f['watches'], f['ratings'], f['letterboxd_guids']), (['2026-10-07'], [9], ['55']))
        self.assertEqual(f['recommended'], ['2026-10-07', '2026-10-08'])

    def test_record_films_takes_the_film_notes_lock(self):
        self.record([card()], 'recommended', '2026-10-08')
        self.assertTrue(os.path.exists(fs.LOCK_FILE))
        with fs.lock(blocking=False):                           # and let it go
            pass

    def test_a_film_created_from_the_weekly_releases_spreads_its_score_day_by_id(self):
        cards = [card(), card('Us', 2019, 458723, 'https://letterboxd.com/film/us-2019/')]
        self.record(cards, 'upcoming', '2026-10-05')
        store = self.on_disk()
        self.assertEqual([store.find(tmdb_id=c['tmdb_id']).fm['score_day'] for c in cards], [419430 % 7, 458723 % 7])   # 4 and 6

    def test_a_recommended_film_keeps_the_weekday_it_was_created_on(self):
        cards = [card(), card('Us', 2019, 458723, 'https://letterboxd.com/film/us-2019/')]
        self.record(cards, 'recommended', '2026-10-08')
        store = self.on_disk()
        today = date.today().weekday()
        self.assertEqual([store.find(tmdb_id=c['tmdb_id']).fm['score_day'] for c in cards], [today, today])


if __name__ == '__main__':
    unittest.main()
