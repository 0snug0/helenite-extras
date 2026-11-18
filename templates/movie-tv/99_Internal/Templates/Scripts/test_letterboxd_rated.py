#!/usr/bin/env python3
"""Tests for letterboxd_rated.py. Run: python3 -m unittest test_letterboxd_rated (from this folder)."""
import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import film_store as fs
import letterboxd_rated as rated


class FakeRadarr:
    def __init__(self):
        self.movies = {}                                   # tmdb id -> movie
        self.deleted = []
        self.unmonitored = []
        self.down = False

    def find(self, tmdb_id):
        if self.down:
            raise OSError('down')
        return self.movies.get(int(tmdb_id))

    def delete(self, movie_id):
        self.deleted.append(movie_id)

    def unmonitor(self, movie):
        self.unmonitored.append(movie['id'])


class RatedTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.store = fs.Store(os.path.join(self.tmp.name, 'Films'))
        self.logs = []
        self.radarr = FakeRadarr()

    def tearDown(self):
        self.tmp.cleanup()

    def film(self, tmdb, title='Sinners', year=2025, kind='movie', listed=True, pending=False):
        film = self.store.upsert(title, year, tmdb_id=tmdb, tmdb_type=kind)
        self.store.set_watchlist(film, listed)
        self.store.set_pending(film, pending)
        film.save()
        return film

    def flags(self, film):
        f = fs.Film.load(film.path).fm                    # what is on disk, not what is in memory
        return f['on_watchlist'], f['pending']

    def run_rated(self, entries):
        rated.forget_rated(entries, self.store, lambda msg, level='INFO': self.logs.append((level, msg)),
                           radarr=self.radarr, pending_path=os.path.join(self.tmp.name, 'pending.json'),
                           now='2026-11-07T12:00:00+00:00')

    ENTRY = {'tmdbId': '102', 'filmTitle': 'Sinners', 'filmYear': 2025, 'userRatingNo': 4.0}

    def test_rated_film_leaves_the_watchlist_but_keeps_its_note(self):
        sinners = self.film(102, pending=True)
        weapons = self.film(101, title='Weapons')
        longer = self.film(1020, title='Other')                # a longer id that merely starts the same
        show = self.film(102, title='Show', kind='tv')         # TMDB tv ids are a separate namespace
        self.run_rated([self.ENTRY])
        self.assertEqual(self.flags(sinners), (False, False))
        self.assertTrue(os.path.exists(sinners.path))
        for other in (weapons, longer, show):
            self.assertEqual(self.flags(other), (True, False))
        self.assertTrue(all(msg.startswith('rated: ') for _, msg in self.logs), self.logs)

    def test_a_rated_film_with_no_note_or_no_flags_writes_nothing(self):
        watched = self.film(102, listed=False)
        with open(watched.path, 'rb') as fh:
            before = fh.read()
        self.run_rated([self.ENTRY, {'tmdbId': '555', 'filmTitle': 'Unknown', 'filmYear': 2020, 'userRatingNo': 3.0}])
        with open(watched.path, 'rb') as fh:
            self.assertEqual(fh.read(), before)
        self.assertEqual([m for _, m in self.logs if m.startswith('rated: ')], [])

    def test_nothing_rated_touches_nothing(self):
        self.run_rated([])
        self.assertEqual(self.logs, [])

    def test_movie_in_radarr_at_rating_time_is_removed(self):
        self.film(102)
        self.radarr.movies[102] = {'id': 7, 'added': '2026-11-01T00:00:00Z'}
        self.run_rated([self.ENTRY])
        self.assertEqual(self.radarr.deleted, [7])

    def test_movie_with_a_file_is_kept_but_unmonitored(self):
        self.film(102)
        self.radarr.movies[102] = {'id': 7, 'added': '2026-11-01T00:00:00Z', 'hasFile': True, 'monitored': True}
        self.run_rated([self.ENTRY])
        self.assertEqual(self.radarr.deleted, [])
        self.assertEqual(self.radarr.unmonitored, [7])

    def test_movie_re_added_after_the_rating_is_kept(self):
        self.radarr.movies[102] = {'id': 7, 'added': '2026-11-08T00:00:00Z'}
        self.run_rated([self.ENTRY])
        self.assertEqual(self.radarr.deleted, [])

    def test_unreachable_radarr_retries_later_but_only_for_the_original_add(self):
        self.radarr.down = True
        self.run_rated([self.ENTRY])
        pend = os.path.join(self.tmp.name, 'pending.json')
        self.assertTrue(os.path.exists(pend))
        self.radarr.down = False
        self.radarr.movies[102] = {'id': 7, 'added': '2026-11-09T00:00:00Z'}   # re-added for a rewatch
        self.run_rated([])
        self.assertEqual(self.radarr.deleted, [])
        self.assertFalse(os.path.exists(pend))

    def test_movie_not_in_radarr_is_a_no_op(self):
        self.run_rated([self.ENTRY])
        self.assertEqual(self.radarr.deleted, [])


if __name__ == '__main__':
    unittest.main()
