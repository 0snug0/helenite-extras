#!/usr/bin/env python3
"""Tests for film_store.py. Run: python3 -m unittest test_film_store (from this folder)."""
import fcntl
import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import film_store as fs


class StoreTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.dir = os.path.join(self.tmp.name, 'Films')
        self.store = fs.Store(self.dir)

    def tearDown(self):
        self.tmp.cleanup()

    def film(self, title='Get Out', year=2017, tmdb_id=419430, **kw):
        return self.store.upsert(title, year, tmdb_id=tmdb_id, today='2026-10-05', **kw)

    def reload(self):
        self.store = fs.Store(self.dir)
        return self.store

    def read(self, film):
        with open(film.path, encoding='utf-8') as fh:
            return fh.read()

    def test_first_watch_creates_the_note_with_derived_fields(self):
        film = self.film(poster='https://img/p.jpg')
        self.assertTrue(self.store.add_watch(film, '2026-10-04', rating=9, guid='111', url='https://lb/1', review='Great.\nReally.'))
        film.save()
        self.assertEqual(os.path.basename(film.path), 'Get Out (2017).md')
        f = self.reload().find(tmdb_id=419430).fm
        self.assertEqual((f['watches'], f['ratings'], f['letterboxd_guids']), (['2026-10-04'], [9], ['111']))
        self.assertEqual((f['watch_count'], f['last_watched'], f['rating']), (1, '2026-10-04', 9))
        self.assertEqual((f['added'], f['score_day']), ('2026-10-05', 0))      # 2026-10-05 is a Monday
        text = self.read(film)
        self.assertIn('watches: [2026-10-04]\n', text)                          # a bare date, so Dataview and Bases read a date
        self.assertIn('### 2026-10-04 ★★★★½\n\n> Great.\n> Really.\n\n[Letterboxd entry](https://lb/1)\n', text)
        self.assertIn('![Poster](https://img/p.jpg)', text)

    def test_rewatch_appends_and_updates_latest_rating(self):
        film = self.film()
        self.store.add_watch(film, '2026-10-04', rating=9, guid='2')
        self.store.add_watch(film, '2019-03-02', rating=8, guid='1')           # an older entry arriving later
        self.store.add_watch(film, '2026-10-07', rating=None, guid='3', rewatch=True)
        film.save()
        f = self.reload().find(tmdb_id=419430).fm
        self.assertEqual(f['watches'], ['2019-03-02', '2026-10-04', '2026-10-07'])
        self.assertEqual(f['ratings'], [8, 9, None])
        self.assertEqual(f['letterboxd_guids'], ['1', '2', '3'])
        self.assertEqual((f['watch_count'], f['last_watched'], f['rating']), (3, '2026-10-07', 9))
        self.assertIn('### 2026-10-07 (rewatch)', self.read(film))

    def test_two_watches_on_one_day_with_different_guids_are_both_kept(self):
        film = self.film()
        self.assertTrue(self.store.add_watch(film, '2026-10-04', rating=8, guid='1'))
        self.assertTrue(self.store.add_watch(film, '2026-10-04', rating=9, guid='2'))
        self.assertEqual(film.fm['watches'], ['2026-10-04', '2026-10-04'])

    def test_repeated_guid_is_a_no_op_even_after_a_reload(self):
        film = self.film()
        self.store.add_watch(film, '2026-10-04', rating=8, guid='1')
        film.save()
        before = self.read(film)
        store = self.reload()
        film = store.find(tmdb_id=419430)
        self.assertFalse(store.add_watch(film, '2026-10-04', rating=8, guid='1'))
        self.assertFalse(film.save())
        self.assertEqual(self.read(film), before)

    def test_guidless_watch_dedupes_on_the_day_unless_told_not_to(self):
        film = self.film()
        self.assertTrue(self.store.add_watch(film, '2023-02-26', rating=6))
        self.assertFalse(self.store.add_watch(film, '2023-02-26', rating=6))
        self.assertTrue(self.store.add_watch(film, '2023-02-26', rating=6, dedupe=False))

    def test_watchlist_on_off_on_keeps_the_first_added_date(self):
        film = self.film()
        self.store.set_watchlist(film, True, '2026-01-24')
        self.store.set_watchlist(film, False)
        self.assertFalse(film.fm['on_watchlist'])
        self.store.set_watchlist(film, True, '2026-10-05')
        self.assertEqual((film.fm['on_watchlist'], film.fm['watchlist_added']), (True, '2026-01-24'))

    def test_recommended_twice_on_one_day_is_one_entry_and_days_stay_sorted(self):
        film = self.film()
        for day in ('2026-10-08', '2026-10-06', '2026-10-08'):
            self.store.add_recommended(film, day)
        self.assertEqual(film.fm['recommended'], ['2026-10-06', '2026-10-08'])

    def test_same_title_and_year_gets_a_tmdb_suffix_and_stays_wikilinkable(self):
        a = self.film('Joy Ride', 2023, 1)
        b = self.film('Joy Ride', 2023, 2)
        self.assertNotEqual(a.path, b.path)
        self.assertEqual(os.path.basename(b.path), 'Joy Ride (2023) (tmdb-2).md')
        self.assertNotIn('[', os.path.basename(b.path))                         # brackets would break [[links]]

    def test_illegal_filename_characters_are_stripped_and_the_title_is_kept(self):
        film = self.film('Spider-Man: Brand New Day', 2026, 5)
        self.assertEqual(os.path.basename(film.path), 'Spider-Man Brand New Day (2026).md')
        self.assertEqual(film.fm['title'], 'Spider-Man: Brand New Day')

    def test_characters_that_break_wikilinks_are_stripped_from_the_filename(self):
        rec = self.film('[REC]', 2007, 8329)
        alive = self.film('#Alive', 2020, 614696)
        self.assertEqual(os.path.basename(rec.path), 'REC (2007).md')
        self.assertEqual(os.path.basename(alive.path), 'Alive (2020).md')
        self.assertEqual((rec.fm['title'], alive.fm['title']), ('[REC]', '#Alive'))
        self.assertEqual(fs.safe_name('Caf^e'), 'Cafe')

    def test_uneven_lists_from_a_hand_edit_lose_no_watch(self):
        os.makedirs(self.dir, exist_ok=True)
        with open(os.path.join(self.dir, 'Raw (2016).md'), 'w', encoding='utf-8') as fh:
            fh.write('---\ntitle: "Raw"\nyear: 2016\ntmdb_id: 393519\nwatches: [2020-01-01, 2020-06-01]\nratings: [8]\n---\n\n# Raw (2016)\n')
        store = self.reload()
        film = store.find(tmdb_id=393519)
        self.assertEqual([(r['watched'], r['rating']) for r in store.watch_rows()], [('2020-01-01', 8), ('2020-06-01', None)])
        store.add_watch(film, '2021-01-01', rating=9, guid='5')
        film.save()
        f = self.reload().find(tmdb_id=393519).fm
        self.assertEqual(f['watches'], ['2020-01-01', '2020-06-01', '2021-01-01'])
        self.assertEqual(f['ratings'], [8, None, 9])
        self.assertEqual(f['letterboxd_guids'], ['', '', '5'])
        self.assertEqual((f['watch_count'], f['rating']), (3, 9))

    def test_found_by_id_whatever_the_year_and_tv_ids_are_a_separate_namespace(self):
        film = self.film('Under the Skin', 2013, 97370)
        self.assertIs(self.store.upsert('Under the Skin', 2014, tmdb_id=97370), film)   # TMDB's wide-release year
        show = self.store.upsert('Some Show', 2020, tmdb_id=97370, tmdb_type='tv')
        self.assertIsNot(show, film)

    def test_title_and_year_find_a_film_with_no_tmdb_id(self):
        show = self.store.upsert('Band of Brothers', 2001)
        self.assertIs(self.store.upsert('Band of Brothers', 2001), show)
        # A note with no id takes one from a later sighting of the same title and year...
        self.assertIs(self.store.upsert('Band of Brothers', 2001, tmdb_id=99), show)
        self.assertEqual(show.fm.get('tmdb_id'), 99)
        # ...after which a different id under that title is a different film.
        self.assertIsNot(self.store.upsert('Band of Brothers', 2001, tmdb_id=100), show)

    def test_unknown_frontmatter_and_hand_edited_body_survive_an_update(self):
        film = self.film()
        self.store.add_watch(film, '2026-10-04', rating=8, guid='1')
        film.save()
        text = self.read(film).replace('---\n\n# Get Out', 'my_tag: keep me\nnotes:\n  - one\n  - two\n---\n\n# Get Out', 1)
        text += '\nMy own paragraph.\n'
        with open(film.path, 'w', encoding='utf-8') as fh:
            fh.write(text)
        store = self.reload()
        film = store.find(tmdb_id=419430)
        store.add_watch(film, '2026-10-07', rating=9, guid='2')
        store.set_credits(film, ['[[Jordan Peele]]'], [('[[Jordan Peele]]', 'Screenplay')], [('[[Daniel Kaluuya]]', 'Chris Washington')])
        film.save()
        out = self.read(film)
        self.assertIn('my_tag: keep me\nnotes:\n  - one\n  - two\n---', out)
        self.assertIn('My own paragraph.', out)
        self.assertIn('await dv.view("99_Internal/Views/film-credits")', out)
        self.assertLess(out.index('### 2026-10-07'), out.index('### 2026-10-04'))

    def test_credits_view_is_set_off_by_blank_lines_so_obsidian_renders_it(self):
        film = self.film()
        self.store.set_credits(film, ['[[Jordan Peele]]'], [], [('[[Daniel Kaluuya]]', 'Chris')])
        out = film.text()
        self.assertIn('%% credits:start %%\n\n```dataviewjs\n', out)
        self.assertIn('\n```\n\n%% credits:end %%', out)

    def test_set_credits_rewrites_the_old_adjacent_form_and_is_idempotent(self):
        film = self.film()
        film.body = film.body.replace('%% credits:start %%\n%% credits:end %%',
                                      '%% credits:start %%\n| Role | Person |\n| --- | --- |\n| Old | [[X]] |\n%% credits:end %%')
        self.store.set_credits(film, ['[[Jordan Peele]]'], [], [])
        once = film.body
        self.assertIn('%% credits:start %%\n\n```dataviewjs\n', once)
        self.assertNotIn('[[X]]', once)
        self.assertIn('\n```\n\n%% credits:end %%', once)
        self.store.set_credits(film, ['[[Jordan Peele]]'], [], [])
        self.assertEqual(film.body, once)

    def test_set_credits_on_a_note_without_markers_adds_the_spaced_block(self):
        film = self.film()
        film.body = '\n# Get Out (2017)\n\n## Watches\n'
        self.store.set_credits(film, ['[[Jordan Peele]]'], [], [])
        self.assertIn('%% credits:start %%\n\n```dataviewjs\n', film.body)
        self.assertIn('\n```\n\n%% credits:end %%\n\n## Watches', film.body)

    def test_a_note_with_no_credits_keeps_the_markers_adjacent(self):
        film = self.film()
        self.assertIn('%% credits:start %%\n%% credits:end %%', film.body)
        self.store.set_credits(film, [], [], [])
        self.assertIn('%% credits:start %%\n%% credits:end %%', film.body)

    def test_block_lists_written_by_obsidians_properties_editor_are_read(self):
        os.makedirs(self.dir, exist_ok=True)
        path = os.path.join(self.dir, 'Raw (2016).md')
        with open(path, 'w', encoding='utf-8') as fh:
            fh.write('---\ntitle: Raw\nyear: 2016\ntmdb_id: 393519\nwatches:\n  - 2024-01-02\n  - 2025-03-04\n'
                     'ratings:\n  - 8\n  - null\nletterboxd_guids:\n  - ""\n  - "77"\ncast:\n  - "[[Garance Marillier]]"\n'
                     'on_watchlist: true\n---\n\n# Raw (2016)\n')
        f = self.reload().find(tmdb_id=393519).fm
        self.assertEqual(f['watches'], ['2024-01-02', '2025-03-04'])
        self.assertEqual(f['ratings'], [8, None])
        self.assertEqual(f['letterboxd_guids'], ['', '77'])
        self.assertEqual(f['cast'], ['[[Garance Marillier]]'])
        self.assertIs(f['on_watchlist'], True)
        self.assertIn('77', self.store.guids)

    def test_names_with_commas_quotes_and_pipes_round_trip(self):
        film = self.film()
        cast = [('[[Robert Downey, Jr.]]', 'Tony "Iron Man" Stark'), ('[[A B (tmdb-9)|A B]]', 'Self | Host')]
        self.store.set_credits(film, [], [], cast)
        film.save()
        f = self.reload().find(tmdb_id=419430).fm
        self.assertEqual(f['cast'], ['[[Robert Downey, Jr.]]', '[[A B (tmdb-9)|A B]]'])
        self.assertEqual(f['cast_roles'], ['Tony "Iron Man" Stark', 'Self | Host'])

    def test_saving_twice_leaves_the_file_byte_identical(self):
        film = self.film(slug='get-out-2017', url='https://letterboxd.com/film/get-out-2017/')
        self.store.add_watch(film, '2026-10-04', rating=8, guid='1')
        self.store.set_pending(film, True, '2026-10-05')
        self.store.set_scores(film, lb=4.1, rt=98, aud=86, rt_url='https://www.rottentomatoes.com/m/get_out', today='2026-10-05')
        self.assertTrue(film.save())
        before = self.read(film)
        film2 = self.reload().find(slug='get-out-2017')
        self.assertFalse(film2.save())
        self.assertEqual(self.read(film2), before)

    def test_a_missing_score_keeps_the_previous_value(self):
        film = self.film()
        self.store.set_scores(film, lb=4.1, rt=98, aud=86, today='2026-10-05')
        self.store.set_scores(film, lb=None, rt=97, aud=None, today='2026-10-12')
        self.assertEqual((film.fm['lb_rating'], film.fm['rt_score'], film.fm['rt_audience'], film.fm['scores_checked']),
                         (4.1, 97, 86, '2026-10-12'))
        self.store.set_scores(film, today='2026-10-19')                         # nothing read at all
        self.assertEqual(film.fm['scores_checked'], '2026-10-12')

    def test_watch_rows_gives_one_row_per_viewing(self):
        film = self.film()
        self.store.add_watch(film, '2019-03-02', rating=8, guid='1')
        self.store.add_watch(film, '2026-10-04', rating=9, guid='2')
        rows = list(self.store.watch_rows())
        self.assertEqual([(r['title'], r['year'], r['tmdb_id'], r['rating'], r['watched']) for r in rows],
                         [('Get Out', 2017, 419430, 8, '2019-03-02'), ('Get Out', 2017, 419430, 9, '2026-10-04')])


class ReloadTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.store = fs.Store(os.path.join(self.tmp.name, 'Films'))

    def tearDown(self):
        self.tmp.cleanup()

    def test_reload_takes_frontmatter_hand_lines_and_body_from_disk(self):
        film = self.store.upsert('Get Out', 2017, tmdb_id=419430)
        film.save()
        other = fs.Film.load(film.path)
        other.fm['pending'] = True
        other.extra.append('my_key: mine')
        other.body += 'a hand note\n'
        other.save()
        self.assertTrue(film.reload())
        self.assertEqual((film.fm['pending'], film.extra), (True, ['my_key: mine']))
        self.assertTrue(film.body.endswith('a hand note\n'))
        self.assertFalse(film.save())                           # now identical to the file

    def test_reload_of_a_deleted_note_leaves_the_film_as_it_is(self):
        film = self.store.upsert('Get Out', 2017, tmdb_id=419430)
        film.save()
        os.remove(film.path)
        self.assertFalse(film.reload())
        self.assertEqual(film.fm['title'], 'Get Out')

    def test_reload_of_an_emptied_note_returns_false_and_keeps_the_film(self):
        film = self.store.upsert('Get Out', 2017, tmdb_id=419430)
        film.save()
        fm, body = dict(film.fm), film.body
        open(film.path, 'w').close()                            # another program truncated it and has not written yet
        self.assertFalse(film.reload())
        self.assertEqual((film.fm, film.body), (fm, body))

    def test_save_leaves_no_temp_file_and_names_it_per_process(self):
        film = self.store.upsert('Get Out', 2017, tmdb_id=419430)
        seen, real = [], os.replace
        os.replace = lambda src, dst: seen.append(src) or real(src, dst)
        try:
            film.save()
        finally:
            os.replace = real
        self.assertEqual(seen, [f'{film.path}.{os.getpid()}.tmp'])
        self.assertEqual(os.listdir(self.store.folder), ['Get Out (2017).md'])

    def test_set_slug_moves_the_film_to_its_new_slug(self):
        film = self.store.upsert('Animals', 2026, tmdb_id=77, slug='animals-2026-2', url='https://letterboxd.com/film/animals-2026-2/')
        self.store.set_slug(film, 'animals-2026')
        self.assertEqual((film.fm['letterboxd_slug'], film.fm['letterboxd_url']), ('animals-2026', 'https://letterboxd.com/film/animals-2026/'))
        self.assertIs(self.store.find(slug='animals-2026'), film)
        self.assertIsNone(self.store.find(slug='animals-2026-2'))

    def test_credits_tried_is_a_key_the_store_owns(self):
        film = self.store.upsert('Get Out', 2017, tmdb_id=419430)
        film.fm['credits_tried'] = '2026-10-08'
        film.save()
        again = fs.Film.load(film.path)
        self.assertEqual((again.fm.get('credits_tried'), again.extra), ('2026-10-08', []))


class LockTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self._lock_file, fs.LOCK_FILE = fs.LOCK_FILE, os.path.join(self.tmp.name, 'state', 'films.lock')

    def tearDown(self):
        fs.LOCK_FILE = self._lock_file
        self.tmp.cleanup()

    def test_the_lock_is_exclusive_and_is_released_on_exit(self):
        with fs.lock():
            with self.assertRaises(fs.Busy):
                with fs.lock(blocking=False):
                    self.fail('a second holder got in')
        with fs.lock(blocking=False):                           # free again
            pass

    def test_a_lock_held_by_another_descriptor_is_busy_until_it_lets_go(self):
        os.makedirs(os.path.dirname(fs.LOCK_FILE))
        with open(fs.LOCK_FILE, 'w') as other:                  # stands in for the other process
            fcntl.flock(other, fcntl.LOCK_EX)
            with self.assertRaises(fs.Busy):
                with fs.lock(blocking=False):
                    self.fail('got a lock someone else holds')
            fcntl.flock(other, fcntl.LOCK_UN)
            with fs.lock(blocking=False):
                with self.assertRaises(BlockingIOError):
                    fcntl.flock(other, fcntl.LOCK_EX | fcntl.LOCK_NB)

    def test_the_lock_is_released_when_the_work_raises(self):
        with self.assertRaises(ValueError):
            with fs.lock():
                raise ValueError('boom')
        with fs.lock(blocking=False):
            pass


if __name__ == '__main__':
    unittest.main()
