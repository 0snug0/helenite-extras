#!/usr/bin/env python3
"""Tests for letterboxd_watchlist.py. Run: python3 -m unittest test_letterboxd_watchlist (from this folder)."""
import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import film_store as fs
import letterboxd_watchlist as wl


def page(*films):
    """A watchlist page as Letterboxd serves it: one poster element per film."""
    return ''.join(f'<div data-item-name="{name}" data-item-slug="{slug}"></div>' for name, slug in films).encode()


class WatchlistTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.store = fs.Store(os.path.join(self.tmp.name, 'Films'))
        self.pages, self.asked, self.logs = {}, [], []

    def tearDown(self):
        self.tmp.cleanup()

    def fetch(self, url):
        self.asked.append(url)
        return self.pages.get(url, b'')

    def listing(self, *films):
        self.pages = {k: v for k, v in self.pages.items() if '/film/' in k}
        self.pages['https://letterboxd.com/example-user/watchlist/'] = page(*films)

    def film_page(self, slug, kind, tmdb_id):
        self.pages[f'https://letterboxd.com/film/{slug}/'] = f'<body data-tmdb-type="{kind}" data-tmdb-id="{tmdb_id}">'.encode()

    def sync(self, added=None):
        self.asked.clear()
        wl.sync_watchlist('example-user', self.store, '', lambda msg, level='INFO': self.logs.append((level, msg)), added, fetch=self.fetch, pause=0)

    def flags(self):
        return {f.fm['title']: f.fm['on_watchlist'] for f in fs.Store(self.store.folder).films}

    def test_new_film_gets_a_note_and_the_flag(self):
        self.listing(('Sinners (2025)', 'sinners-2025'))
        self.film_page('sinners-2025', 'movie', 102)
        self.sync({('Sinners', 2025): '2026-01-24'})
        f = fs.Store(self.store.folder).find(tmdb_id=102).fm
        self.assertEqual((f['title'], f['year'], f['on_watchlist'], f['watchlist_added'], f['letterboxd_slug']),
                         ('Sinners', 2025, True, '2026-01-24', 'sinners-2025'))
        self.assertEqual(f['letterboxd_url'], 'https://letterboxd.com/film/sinners-2025/')

    def test_tv_series_and_shows_kept_on_serializd_get_no_film_note(self):
        self.listing(('The Bear (2022)', 'the-bear'), ('Hal & Harper (2025)', 'hal-harper'), ('Sinners (2025)', 'sinners-2025'))
        self.film_page('the-bear', 'tv', 136315)
        self.film_page('sinners-2025', 'movie', 102)
        self.asked.clear()
        wl.sync_watchlist('example-user', self.store, '', lambda msg, level='INFO': self.logs.append((level, msg)), fetch=self.fetch, pause=0,
                          skip={'hal-harper'})
        self.assertEqual(self.flags(), {'Sinners': True})
        self.assertNotIn('https://letterboxd.com/film/hal-harper/', self.asked)     # a skipped slug costs no page fetch

    def test_a_watched_film_added_to_the_watchlist_reuses_its_note(self):
        film = self.store.upsert('Get Out', 2017, tmdb_id=419430)
        self.store.add_watch(film, '2019-03-02', rating=8, guid='1')
        film.save()
        self.listing(('Get Out (2017)', 'get-out-2017'))
        self.film_page('get-out-2017', 'movie', 419430)
        self.sync()
        store = fs.Store(self.store.folder)
        self.assertEqual(len(store.films), 1)
        f = store.films[0].fm
        self.assertEqual((f['watches'], f['on_watchlist'], f['letterboxd_slug']), (['2019-03-02'], True, 'get-out-2017'))

    def test_a_known_slug_costs_no_film_page_fetch(self):
        self.listing(('Sinners (2025)', 'sinners-2025'))
        self.film_page('sinners-2025', 'movie', 102)
        self.sync()
        self.sync()
        self.assertNotIn('https://letterboxd.com/film/sinners-2025/', self.asked)

    def test_film_that_left_the_watchlist_loses_the_flag_but_keeps_its_note(self):
        self.listing(('Sinners (2025)', 'sinners-2025'), ('Weapons (2025)', 'weapons-2025'))
        self.film_page('sinners-2025', 'movie', 102)
        self.film_page('weapons-2025', 'movie', 101)
        self.sync()
        self.listing(('Weapons (2025)', 'weapons-2025'))
        self.sync()
        self.assertEqual(self.flags(), {'Sinners': False, 'Weapons': True})

    def test_an_empty_scrape_clears_nothing(self):
        self.listing(('Sinners (2025)', 'sinners-2025'))
        self.film_page('sinners-2025', 'movie', 102)
        self.sync()
        self.listing()                                   # Letterboxd down, or its markup changed
        self.sync()
        self.assertEqual(self.flags(), {'Sinners': True})
        self.assertIn(('WARN', 'watchlist: scrape returned nothing - skipping removals'), self.logs)

    def test_pending_is_not_touched(self):
        film = self.store.upsert('Sinners', 2025, tmdb_id=102, slug='sinners-2025')
        self.store.set_pending(film, True)
        self.store.set_watchlist(film, True)
        film.save()
        self.listing(('Weapons (2025)', 'weapons-2025'))
        self.film_page('weapons-2025', 'movie', 101)
        self.sync()
        f = fs.Store(self.store.folder).find(tmdb_id=102).fm
        self.assertEqual((f['on_watchlist'], f['pending']), (False, True))

    def test_a_renamed_slug_keeps_the_film_on_the_watchlist(self):
        self.listing(('Animals (2026)', 'animals-2026-2'))
        self.film_page('animals-2026-2', 'movie', 77)
        self.sync()
        self.listing(('Animals (2026)', 'animals-2026'))        # Letterboxd renamed the slug
        self.film_page('animals-2026', 'movie', 77)
        self.logs.clear()
        self.sync()
        store = fs.Store(self.store.folder)
        self.assertEqual(len(store.films), 1)
        f = store.films[0].fm
        self.assertEqual((f['on_watchlist'], f['letterboxd_slug'], f['letterboxd_url']),
                         (True, 'animals-2026', 'https://letterboxd.com/film/animals-2026/'))
        self.assertEqual([m for _, m in self.logs if 'removed ' in m or 'added ' in m], [])
        self.assertIn(('INFO', 'watchlist: 0 added, 0 removed'), self.logs)
        self.assertIsNone(self.store.by_slug.get('animals-2026-2'))
        self.logs.clear()
        self.sync()                                             # the run after: the new slug is known
        self.assertNotIn('https://letterboxd.com/film/animals-2026/', self.asked)
        self.assertEqual([m for _, m in self.logs if 'removed ' in m or 'added ' in m], [])
        self.assertEqual(self.flags(), {'Animals': True})


    def test_a_title_match_without_a_tmdb_id_does_not_overwrite_the_notes_slug(self):
        film = self.store.upsert('Get Out', 2017, tmdb_id=419430, slug='get-out', url='https://letterboxd.com/film/get-out/')
        film.save()
        self.listing(('Get Out (2017)', 'get-out-2017'))        # some other listing; its page names no TMDB id
        self.pages['https://letterboxd.com/film/get-out-2017/'] = b'<body>'
        self.sync()
        store = fs.Store(self.store.folder)
        self.assertEqual(len(store.films), 1)
        f = store.films[0].fm
        self.assertEqual((f['on_watchlist'], f['letterboxd_slug'], f['letterboxd_url']),
                         (True, 'get-out', 'https://letterboxd.com/film/get-out/'))

if __name__ == '__main__':
    unittest.main()
