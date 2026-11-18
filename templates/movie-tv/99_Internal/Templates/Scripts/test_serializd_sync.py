#!/usr/bin/env python3
"""Tests for serializd_sync.py. Run: python3 -m unittest test_serializd_sync (from this folder)."""
import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import film_store as fs
import people as pp
import serializd_sync as ss

PHONY = [{'id': 425115, 'seasonNumber': 1, 'name': 'Season 1'}]


def review(rid, ep, day, rating=7, text='', show=275139, name='Phony', seasons=PHONY, season_id=425115, **o):
    return {'id': rid, 'showId': show, 'showName': name, 'seasonId': season_id, 'showSeasons': seasons,
            'episodeNumber': ep, 'episodeName': f'Ep {ep}' if ep else None, 'rating': rating, 'reviewText': text,
            'backdate': f'{day}T12:00:00Z', 'dateAdded': f'{day}T20:00:00Z', 'isRewatch': False, **o}


TV = {275139: {'name': 'Phony', 'first_air_date': '2026-10-20', 'poster_path': '/phony.jpg'},
      291507: {'name': 'The Body', 'first_air_date': '2026-11-01', 'poster_path': '/body.jpg'}}


class SyncTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.store = fs.Store(os.path.join(self.tmp.name, 'Shows'))
        self.calls, self.logs = [], []

    def tearDown(self):
        self.tmp.cleanup()

    def tmdb(self, path):
        self.calls.append(path)
        sid = int(path.split('/')[2])
        if path.endswith('/aggregate_credits'):
            return {'cast': [{'id': 1, 'name': 'Jack Kesy', 'roles': [{'character': 'Sonny'}], 'order': 0}], 'crew': []}
        return TV.get(sid)

    def sync(self, watchlist=(), watching=(), reviews=(), today='2026-11-18'):
        return ss.sync(self.store, self.tmdb, (list(watchlist), list(watching), list(reviews)), today=today,
                       log=lambda m, level='INFO': self.logs.append((level, m)))

    def reload(self):
        return fs.Store(self.store.folder)

    def test_diary_entries_become_watches_on_one_show_note(self):
        self.sync(reviews=[review(2, 5, '2026-11-17', 7, 'Great'), review(1, 4, '2026-11-10', 8)])
        [note] = self.reload().films
        f = note.fm
        self.assertEqual(os.path.basename(note.path), 'Phony (2026).md')
        self.assertEqual((f['Type'], f['tmdb_type'], f['tmdb_id'], f['year']), ('Show', 'tv', 275139, 2026))
        self.assertEqual(f['poster'], 'https://image.tmdb.org/t/p/w500/phony.jpg')
        self.assertEqual(f['serializd_url'], 'https://www.serializd.com/show/275139')
        self.assertEqual(f['watches'], ['2026-11-10', '2026-11-17'])
        self.assertEqual(f['ratings'], [8, 7])
        self.assertEqual(f['letterboxd_guids'], ['sz:1:S01E04', 'sz:2:S01E05'])
        self.assertEqual((f['watch_count'], f['last_watched'], f['rating']), (2, '2026-11-17', 7))
        self.assertIn('### 2026-11-17 S01E05 Ep 5 ★★★½', note.body)
        self.assertIn('> Great', note.body)
        self.assertNotIn('Letterboxd', note.body)

    def test_a_second_run_adds_nothing_and_writes_nothing(self):
        r = [review(1, 4, '2026-11-10')]
        self.sync(reviews=r, watching=[{'showId': 275139, 'dateAdded': '2026-11-12T00:00:00Z'}])
        before = open(self.reload().films[0].path).read()
        self.store = self.reload()
        self.sync(reviews=r, watching=[{'showId': 275139, 'dateAdded': '2026-11-12T00:00:00Z'}])
        self.assertEqual(open(self.reload().films[0].path).read(), before)
        self.assertEqual(self.calls.count('/tv/275139'), 1)

    def test_season_log_unrated_and_rewatch(self):
        seasons = [{'id': 10, 'seasonNumber': 1, 'name': 'Season 1'}, {'id': 11, 'seasonNumber': 2, 'name': 'Season 2'}]
        self.sync(reviews=[review(9, None, '2026-01-02', 0, show=291507, name='The Body', seasons=seasons, season_id=11, isRewatch=True)])
        f = self.reload().films[0]
        self.assertEqual(f.fm['letterboxd_guids'], ['sz:9:S02'])
        self.assertEqual(f.fm['ratings'], [None])
        self.assertIn('### 2026-01-02 Season 2 (rewatch)', f.body)

    def test_lists_set_and_clear_watchlist_and_watching(self):
        self.sync(watchlist=[{'showId': 291507, 'showName': 'The Body', 'dateAdded': '2026-11-13T03:54:37Z'}],
                  watching=[{'showId': 275139, 'showName': 'Phony', 'dateAdded': '2026-11-12T03:28:42Z'}])
        by = {n.fm['tmdb_id']: n.fm for n in self.reload().films}
        self.assertEqual((by[291507]['on_watchlist'], by[291507]['watchlist_added'], by[291507]['watching']), (True, '2026-11-13', False))
        self.assertEqual((by[275139]['watching'], by[275139]['watching_added'], by[275139]['on_watchlist']), (True, '2026-11-12', False))
        self.store = self.reload()
        self.sync(watchlist=[{'showId': 291507, 'dateAdded': '2026-11-13T03:54:37Z'}])     # Phony finished
        by = {n.fm['tmdb_id']: n.fm for n in self.reload().films}
        self.assertEqual(by[275139]['watching'], False)
        self.assertNotIn('watching_added', by[275139])
        self.assertEqual(by[291507]['on_watchlist'], True)

    def test_both_lists_empty_while_notes_are_flagged_leaves_them(self):
        self.sync(watching=[{'showId': 275139, 'dateAdded': '2026-11-12T00:00:00Z'}])
        self.store = self.reload()
        self.sync()
        self.assertTrue(self.reload().films[0].fm['watching'])
        self.assertIn('WARN', [lvl for lvl, _ in self.logs])

    def test_people_count_films_and_shows_together(self):
        """An actor in one watched film and one watched show gets a person note; either alone would not."""
        self.sync(reviews=[review(1, 1, '2026-11-10')])
        films = fs.Store(os.path.join(self.tmp.name, 'Films'))
        film = films.upsert('Some Film', 2020, tmdb_id=5, today='2026-11-01')
        films.add_watch(film, '2026-11-01', 8)
        film.save()
        people = pp.People(os.path.join(self.tmp.name, 'People'), os.path.join(self.tmp.name, 'people-index.json'))
        movie = lambda path: {'cast': [{'id': 1, 'name': 'Jack Kesy', 'character': 'Someone', 'order': 0}], 'crew': []}
        pp.run(films, movie, people, today='2026-11-18', log=lambda *a: None)
        self.assertFalse(os.path.exists(os.path.join(self.tmp.name, 'People', 'Jack Kesy.md')))
        shows = self.reload()
        _, created = pp.run(shows, self.tmdb, people, today='2026-11-18', log=lambda *a: None, also=[films])
        self.assertEqual(created, 1)
        self.assertTrue(os.path.exists(os.path.join(self.tmp.name, 'People', 'Jack Kesy.md')))
        self.assertIn('/tv/275139/aggregate_credits', self.calls)
        self.assertEqual(self.reload().films[0].fm['cast_roles'], ['Sonny'])


class CreditsTest(unittest.TestCase):
    def test_tv_crew_is_cut_to_the_most_episodes(self):
        crew = [{'id': i, 'name': f'Dir {i}', 'department': 'Directing', 'jobs': [{'job': 'Director', 'episode_count': i}]} for i in range(1, 9)]
        directors, _, _ = pp.split_credits({'crew': crew, 'cast': []}, crew_cap=3)
        self.assertEqual([d['name'] for d in directors], ['Dir 8', 'Dir 7', 'Dir 6'])


if __name__ == '__main__':
    unittest.main()
