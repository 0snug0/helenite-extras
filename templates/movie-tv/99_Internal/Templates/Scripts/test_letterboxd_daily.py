#!/usr/bin/env python3
"""Tests for letterboxd_daily.py. Run: python3 -m unittest test_letterboxd_daily (from this folder)."""
import fcntl
import json
import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import film_store as fs
import letterboxd_daily as daily
import letterboxd_rated

RATED = [{'guid': '50', 'tmdbId': '102', 'filmTitle': 'Sinners', 'filmYear': 2025, 'userRatingNo': 4.0}]
FEED = RATED + [{'guid': str(g)} for g in range(1, 50)]


class ConfirmedRatedTest(unittest.TestCase):
    def setUp(self):
        self.logs = []
        self._log, daily.log = daily.log, lambda msg, level='INFO': self.logs.append((level, msg))

    def tearDown(self):
        daily.log = self._log

    def test_a_feed_with_nothing_on_disk_yet_clears_no_film(self):
        self.assertEqual(daily.confirmed_rated(RATED, FEED, set()), [])            # first run
        self.assertEqual(daily.confirmed_rated(RATED, FEED, {'900', '901'}), [])   # a gap longer than the feed
        self.assertEqual(self.logs[0][0], 'WARN')

    def test_a_feed_that_overlaps_the_disk_passes_its_rated_entries_through(self):
        self.assertEqual(daily.confirmed_rated(RATED, FEED, {'1', '2'}), RATED)
        self.assertEqual(self.logs, [])

    def test_nothing_rated_is_nothing_to_do_and_nothing_to_warn_about(self):
        self.assertEqual(daily.confirmed_rated([], FEED, set()), [])
        self.assertEqual(self.logs, [])


class EnrichTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.store = fs.Store(os.path.join(self.tmp.name, 'Films'))
        self._state = daily.NO_MATCH_FILE, daily.STATE_DIR, daily.log
        daily.STATE_DIR = os.path.join(self.tmp.name, 'state')
        daily.NO_MATCH_FILE = os.path.join(daily.STATE_DIR, 'tmdb-no-match.json')
        daily.log = lambda msg, level='INFO': None
        import tmdb_match
        self.tmdb_match, self._pick = tmdb_match, tmdb_match.pick

    def tearDown(self):
        daily.NO_MATCH_FILE, daily.STATE_DIR, daily.log = self._state
        self.tmdb_match.pick = self._pick
        self.tmp.cleanup()

    def test_a_watched_film_without_an_id_gets_id_and_poster(self):
        film = self.store.upsert('Raw', 2016)
        self.store.add_watch(film, '2026-10-06', rating=9, guid='1')
        self.tmdb_match.pick = lambda title, year, token: (393519, '/raw.jpg', 'exact')
        self.assertEqual(daily.enrich(self.store, 'token'), (1, 0, 0))
        self.assertEqual(film.fm['tmdb_id'], 393519)
        self.assertTrue(film.fm['poster'].endswith('/raw.jpg'))

    def test_an_id_that_another_note_already_has_is_not_given_to_a_second_note(self):
        self.store.upsert('Raw', 2016, tmdb_id=393519).save()
        dup = self.store.upsert('Raw', 2017)                    # the same film under Letterboxd's other year
        self.store.add_watch(dup, '2026-10-06', rating=9, guid='1')
        self.tmdb_match.pick = lambda title, year, token: (393519, '/raw.jpg', 'year+1')
        self.assertEqual(daily.enrich(self.store, 'token'), (0, 0, 0))
        self.assertIsNone(dup.fm.get('tmdb_id'))

    def test_unwatched_films_are_left_alone(self):
        self.store.upsert('Sinners', 2025)                      # suggested only, no id
        self.tmdb_match.pick = lambda *a: self.fail('should not search')
        self.assertEqual(daily.enrich(self.store, 'token'), (0, 0, 0))


def item(guid, title, year, watched, rating, tmdb, review):
    rating_xml = f'<letterboxd:memberRating>{rating}</letterboxd:memberRating>' if rating is not None else ''
    return (f'<item><title>{title}</title><link>https://letterboxd.com/example-user/film/{title.lower()}/{guid}/</link>'
            f'<guid isPermaLink="false">letterboxd-review-{guid}</guid>'
            f'<letterboxd:watchedDate>{watched}</letterboxd:watchedDate><letterboxd:rewatch>No</letterboxd:rewatch>'
            f'<letterboxd:filmTitle>{title}</letterboxd:filmTitle><letterboxd:filmYear>{year}</letterboxd:filmYear>'
            f'{rating_xml}<tmdb:movieId>{tmdb}</tmdb:movieId>'
            f'<description><![CDATA[<p><img src="https://a.ltrbxd.com/{title}.jpg"/></p><p>{review}</p>]]></description></item>')


def feed(*items):
    return ('<?xml version="1.0" encoding="utf-8"?><rss version="2.0" '
            'xmlns:letterboxd="https://letterboxd.com" xmlns:tmdb="https://themoviedb.org">'
            f'<channel>{"".join(items)}</channel></rss>').encode()


class MainTest(unittest.TestCase):
    """daily.main() end to end, with a temp vault, a canned feed, no TMDB token and a recorder for forget_rated."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.config = os.path.join(self.tmp.name, 'config.json')
        with open(self.config, 'w') as fh:
            json.dump({'username': 'example-user'}, fh)
        self.saved = (daily.VAULT, daily.CONFIG, daily.fetch_feed, daily.tmdb_token, daily.log, daily.QUIET,
                      sys.argv, letterboxd_rated.forget_rated, fs.LOCK_FILE)
        fs.LOCK_FILE = os.path.join(self.tmp.name, 'state', 'films.lock')
        self.logs, self.rated_calls, self.xml = [], [], b''
        daily.VAULT, daily.CONFIG = self.tmp.name, self.config
        daily.fetch_feed = lambda username: self.xml
        daily.tmdb_token = lambda: ''
        daily.log = lambda msg, level='INFO': self.logs.append((level, msg))
        sys.argv = ['letterboxd_daily.py', '--diary-only']
        letterboxd_rated.forget_rated = lambda entries, store, log: self.rated_calls.append(list(entries))

    def tearDown(self):
        (daily.VAULT, daily.CONFIG, daily.fetch_feed, daily.tmdb_token, daily.log, daily.QUIET,
         sys.argv, letterboxd_rated.forget_rated, fs.LOCK_FILE) = self.saved
        self.tmp.cleanup()

    SINNERS = item(101, 'Sinners', 2025, '2026-10-06', 4.5, 102, 'Great film.')
    WEAPONS = item(102, 'Weapons', 2025, '2026-10-07', None, 101, 'Unrated.')

    def films(self):
        return fs.Store(os.path.join(self.tmp.name, fs.FILMS_REL))

    def test_the_diary_flows_into_film_notes_and_the_rated_cleanup_is_guarded(self):
        self.xml = feed(self.SINNERS, self.WEAPONS)

        daily.main()                                                       # first run: nothing on disk yet
        store = self.films()
        self.assertEqual(len(store.films), 2)
        f = store.find(tmdb_id=102)
        self.assertEqual((f.fm['watches'], f.fm['ratings'], f.fm['letterboxd_guids']), (['2026-10-06'], [9], ['101']))
        self.assertIn('Great film.', f.body)
        self.assertEqual(store.find(tmdb_id=101).fm['ratings'], [None])
        self.assertEqual(self.rated_calls, [[]])                           # the first-run guard held the rated entry back

        daily.main()                                                       # same feed again: nothing new
        store = self.films()
        self.assertEqual([x.fm['watch_count'] for x in store.films], [1, 1])
        self.assertEqual(self.rated_calls, [[], []])

        self.xml = feed(self.SINNERS, self.WEAPONS, item(103, 'Nope', 2024, '2026-10-08', 3.0, 7, 'Fine.'))
        daily.main()                                                       # one new rated item, and the feed overlaps the disk
        store = self.films()
        self.assertEqual(len(store.films), 3)
        self.assertEqual([[e['guid'] for e in call] for call in self.rated_calls], [[], [], ['103']])
        self.assertEqual(store.find(tmdb_id=7).fm['ratings'], [6])

    def test_the_poll_steps_aside_quietly_when_another_writer_holds_the_lock(self):
        self.xml = feed(self.SINNERS)
        os.makedirs(os.path.dirname(fs.LOCK_FILE))
        with open(fs.LOCK_FILE, 'w') as other:                  # stands in for the 09:00 run
            fcntl.flock(other, fcntl.LOCK_EX)
            daily.main()
            self.assertEqual(self.films().films, [])
            self.assertEqual(self.rated_calls, [])
            self.assertEqual([level for level, _ in self.logs], ['INFO'])
            self.assertFalse(self.logs[0][1].startswith(('created ', 'enriched ', 'rated: ')))      # so the quiet filter drops it
        self.logs.clear()
        daily.main()                                            # the next poll, lock free
        self.assertEqual(len(self.films().films), 1)

    def test_the_run_lets_go_of_the_lock(self):
        self.xml = feed(self.SINNERS)
        daily.main()
        with fs.lock(blocking=False):
            pass


if __name__ == '__main__':
    unittest.main()
