#!/usr/bin/env python3
"""Tests for tv_home.py. Run: python3 -m unittest test_tv_home (from this folder)."""
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import film_store as fs
import tv_home as th

TODAY = '2026-11-18'


def ep(s, e, air, typ='standard'):
    return {'season_number': s, 'episode_number': e, 'air_date': air, 'name': f'E{e}', 'episode_type': typ}


SEASON1 = [ep(1, 1, '2026-10-20'), ep(1, 2, '2026-10-20'), ep(1, 3, '2026-10-27'), ep(1, 4, '2026-11-03'),
           ep(1, 5, '2026-11-10'), ep(1, 6, '2026-11-17'), ep(1, 7, '2026-11-24'), ep(1, 8, '2026-12-01', 'finale')]


def note(tid, title, guids=(), **fm):
    return fs.Film(f'/v/Shows/{title}.md', {'tmdb_id': tid, 'title': title, 'letterboxd_guids': list(guids),
                                            'watches': ['2026-11-01'] * len(guids), 'ratings': [8] * len(guids), **fm})


class PureTest(unittest.TestCase):
    def test_last_logged_takes_the_furthest_and_a_season_log_counts_as_its_end(self):
        self.assertEqual(th.last_logged({'letterboxd_guids': ['sz:1:S01E02', 'sz:2:S01E05', 'x']}), (1, 5))
        self.assertEqual(th.last_logged({'letterboxd_guids': ['sz:1:S01E09', 'sz:2:S01']}), (1, th.INF))
        self.assertIsNone(th.last_logged({'letterboxd_guids': []}))

    def test_up_next_counts_what_is_waiting(self):
        nxt, behind, aired = th.up_next(SEASON1, (1, 3), TODAY)
        self.assertEqual((nxt['episode_number'], behind, aired), (4, 3, 6))
        nxt, behind, _ = th.up_next(SEASON1, (1, 6), TODAY)
        self.assertEqual((nxt['episode_number'], behind), (7, 0))
        self.assertEqual(th.up_next(SEASON1, None, TODAY)[0]['episode_number'], 1)
        self.assertIsNone(th.up_next(SEASON1, (1, 8), TODAY)[0])

    def test_aired_total(self):
        d = {'last_episode_to_air': {'season_number': 3, 'episode_number': 4},
             'seasons': [{'season_number': 0, 'episode_count': 9}, {'season_number': 1, 'episode_count': 6}, {'season_number': 2, 'episode_count': 22}, {'season_number': 3, 'episode_count': 25}]}
        self.assertEqual(th.aired_total(d), 32)
        self.assertEqual(th.aired_total({}), 0)

    def test_when(self):
        self.assertEqual(th.when('2026-11-17', TODAY), ('out', 'Out now'))
        self.assertEqual(th.when('2026-11-18', TODAY), ('today', 'Airs today'))
        self.assertEqual(th.when('2026-11-19', TODAY), ('soon', 'Tomorrow'))
        self.assertEqual(th.when('2026-11-21', TODAY), ('soon', 'Saturday'))
        self.assertEqual(th.when('2026-12-01', TODAY), ('later', 'Dec 1 · in 13 days'))
        self.assertEqual(th.when('2027-01-05', TODAY)[1], 'Jan 5, 2027 · in 48 days')
        self.assertEqual(th.when(None, TODAY), ('tba', 'Date not announced'))

    def test_score_recs_sums_seeds_and_names_the_strongest_first(self):
        recs = {1: [{'id': 10, 'poster_path': '/a'}, {'id': 11, 'poster_path': '/b'}],
                2: [{'id': 11, 'poster_path': '/b'}, {'id': 12, 'poster_path': None}, {'id': 99, 'poster_path': '/c'}]}
        out = th.score_recs([(1, 'Phony', 0.8), (2, 'The Body', 0.9)], recs.get, exclude={99})
        self.assertEqual([r['id'] for r, _, _ in out], [11, 10])
        self.assertEqual(out[0][2], ['The Body', 'Phony'])
        self.assertEqual(th.because(['A', 'B', 'C', 'D']), 'Because you liked A, B and C')
        self.assertEqual(th.because(['A']), 'Because you liked A')


class BuildTest(unittest.TestCase):
    def tmdb(self, path, **params):
        self.calls.append(path)
        if path == '/tv/1':
            return {'status': 'Returning Series', 'number_of_seasons': 1, 'backdrop_path': '/bd.jpg',
                    'next_episode_to_air': ep(1, 7, '2026-11-24'), 'last_episode_to_air': ep(1, 6, '2026-11-17')}
        if path == '/tv/2':
            return {'status': 'Returning Series', 'number_of_seasons': 2, 'next_episode_to_air': {**ep(2, 1, '2026-11-20'), 'season_number': 2}}
        if path == '/tv/1/season/1':
            return {'episodes': SEASON1}
        if path == '/tv/2/season/2':
            return {'episodes': [ep(2, 1, '2026-11-20'), ep(2, 2, '2026-11-27')]}
        if path.endswith('/watch/providers'):
            return {'results': {'US': {'flatrate': [{'provider_name': 'Netflix' if '/2/' in path else 'Hulu'}]}}}
        if path.endswith('/recommendations'):
            return {'results': [{'id': 50, 'name': 'Rec', 'poster_path': '/r.jpg', 'first_air_date': '2025-01-01', 'vote_average': 8, 'vote_count': 100},
                                {'id': 2, 'name': 'Already followed', 'poster_path': '/x.jpg'}]}
        if path == '/discover/tv':
            return {'results': [{'id': 60, 'name': 'New One', 'poster_path': '/n.jpg', 'first_air_date': params.get('first_air_date.gte')}]}
        return None

    def setUp(self):
        self.calls = []
        self.notes = [note(1, 'Phony', ['sz:1:S01E04'], watching=True, poster='p1'),
                      note(2, 'Returner', [], on_watchlist=True, poster='p2')]

    def test_build(self):
        out = th.build(self.notes, self.tmdb, TODAY, files={1: {(1, 5)}}, log=lambda *a: None)
        today_ep = th.build(self.notes, self.tmdb, '2026-11-17', log=lambda *a: None)['week']
        self.assertIn(('2026-11-17', 'Phony', 'S01E06'), [(w['date'], w['title'], w['code']) for w in today_ep])   # airing today: TMDB's "last" episode
        [u] = out['upnext']
        self.assertEqual((u['status'], u['label'], u['behind'], u['last'], u['streams'], u['mine']), ('out', 'Out now', 2, 'S01E04', ['Hulu'], False))
        self.assertEqual((u['next']['code'], u['next']['in_plex'], u['next']['season_done'], u['next']['season_total']), ('S01E05', True, 4, 8))
        self.assertEqual([(w['date'], w['title'], w['code']) for w in out['week']], [('2026-11-20', 'Returner', 'S02E01'), ('2026-11-24', 'Phony', 'S01E07')])  # Nov 18-24 inclusive
        self.assertEqual([r['tmdb_id'] for r in out['recs']], [50])
        self.assertEqual(out['recs'][0]['why'], 'Because you liked Phony and Returner')
        self.assertEqual(out['recs'][0]['rating'], 4.0)
        self.assertEqual([(r['title'], r['label']) for r in out['returning']], [('Returner', 'Season 2 premieres')])
        self.assertEqual([r['tmdb_id'] for r in out['released']], [60])

    def test_daily_parts_are_reused_the_same_day(self):
        first = th.build(self.notes, self.tmdb, TODAY, log=lambda *a: None)
        self.calls.clear()
        again = th.build(self.notes, self.tmdb, TODAY, previous=first, log=lambda *a: None)
        self.assertEqual(again['recs'], first['recs'])
        self.assertFalse([c for c in self.calls if 'recommendations' in c or 'discover' in c])

    def test_blocked_and_followed_shows_are_never_recommended(self):
        out = th.build(self.notes, self.tmdb, TODAY, blocked=[{'tmdb_id': 50}], log=lambda *a: None)
        self.assertEqual(out['recs'], [])


if __name__ == '__main__':
    unittest.main()
