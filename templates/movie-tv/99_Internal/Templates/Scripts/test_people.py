#!/usr/bin/env python3
"""Tests for people.py. Run: python3 -m unittest test_people (from this folder)."""
import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import film_store as fs
import people as pp


def cast(n, start=100):
    return [{'id': start + i, 'name': f'Actor {i}', 'character': f'Role {i}', 'order': i, 'profile_path': f'/a{i}.jpg',
             'known_for_department': 'Acting'} for i in range(n)]


GET_OUT = {
    'cast': [{'id': 1, 'name': 'Daniel Kaluuya', 'character': 'Chris Washington', 'order': 0, 'profile_path': '/dk.jpg', 'known_for_department': 'Acting'},
             {'id': 2, 'name': 'Jordan Peele', 'character': 'Wounded Deer (voice)', 'order': 30, 'profile_path': '/jp.jpg', 'known_for_department': 'Directing'}],
    'crew': [{'id': 2, 'name': 'Jordan Peele', 'job': 'Director', 'department': 'Directing', 'profile_path': '/jp.jpg', 'known_for_department': 'Directing'},
             {'id': 2, 'name': 'Jordan Peele', 'job': 'Screenplay', 'department': 'Writing', 'profile_path': '/jp.jpg', 'known_for_department': 'Directing'},
             {'id': 2, 'name': 'Jordan Peele', 'job': 'Story', 'department': 'Writing'},
             {'id': 3, 'name': 'Sean McKittrick', 'job': 'Producer', 'department': 'Production'}],
}

NOPE = {
    'cast': [{'id': 1, 'name': 'Daniel Kaluuya', 'character': 'OJ Haywood', 'order': 0, 'profile_path': '/dk.jpg', 'known_for_department': 'Acting'},
             {'id': 4, 'name': 'Keke Palmer', 'character': 'Emerald Haywood', 'order': 1, 'profile_path': '/kp.jpg', 'known_for_department': 'Acting'}],
    'crew': [{'id': 2, 'name': 'Jordan Peele', 'job': 'Director', 'department': 'Directing', 'profile_path': '/jp.jpg', 'known_for_department': 'Directing'}],
}


class PeopleTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.store = fs.Store(os.path.join(self.tmp.name, 'Films'))
        self.dir = os.path.join(self.tmp.name, 'People')
        self.index = os.path.join(self.tmp.name, 'Data', 'people-index.json')
        self.people = pp.People(self.dir, self.index)
        self.credits = {}
        self.logs = []

    def tearDown(self):
        self.tmp.cleanup()

    def tmdb(self, path):
        got = self.credits[path]
        if isinstance(got, Exception):
            raise got
        return got

    def run_people(self, today='2026-10-08'):
        return pp.run(self.store, self.tmdb, self.people, today=today, log=lambda msg, level='INFO': self.logs.append((level, msg)))

    def watch_both(self):
        """Get Out and Nope, both watched: Kaluuya and Peele are on two films, Palmer on one."""
        film = self.store.upsert('Get Out', 2017, tmdb_id=419430)
        self.store.add_watch(film, '2026-10-04', rating=9, guid='1')
        self.store.add_watch(self.store.upsert('Nope', 2022, tmdb_id=762504), '2026-10-05', rating=8, guid='2')
        self.credits.update({'/movie/419430/credits': GET_OUT, '/movie/762504/credits': NOPE})
        return film

    def notes(self):
        return sorted(os.listdir(self.dir))

    def on_disk(self, film):
        return fs.Film.load(film.path).fm

    def test_cast_is_cut_to_the_top_25_by_billing_order(self):
        people = list(reversed(cast(40)))                       # TMDB order is not guaranteed
        _, _, got = pp.split_credits({'cast': people, 'crew': []})
        self.assertEqual([p['name'] for p, _ in got], [f'Actor {i}' for i in range(25)])
        self.assertEqual(got[0][1], 'Role 0')

    def test_a_person_who_directs_writes_and_acts_is_in_all_three_with_joined_jobs(self):
        directors, writers, got = pp.split_credits(GET_OUT)
        self.assertEqual([p['name'] for p in directors], ['Jordan Peele'])
        self.assertEqual([(p['name'], jobs) for p, jobs in writers], [('Jordan Peele', 'Screenplay, Story')])
        self.assertEqual([(p['name'], r) for p, r in got], [('Daniel Kaluuya', 'Chris Washington'), ('Jordan Peele', 'Wounded Deer (voice)')])

    def test_tv_aggregate_credits_are_read(self):
        credits = {'cast': [{'id': 9, 'name': 'Damian Lewis', 'order': 0, 'roles': [{'character': 'Richard Winters'}]}],
                   'crew': [{'id': 8, 'name': 'David Frankel', 'department': 'Directing', 'jobs': [{'job': 'Director'}]}]}
        directors, _, got = pp.split_credits(credits)
        self.assertEqual(([p['name'] for p in directors], [(p['name'], r) for p, r in got]), (['David Frankel'], [('Damian Lewis', 'Richard Winters')]))

    def test_people_on_two_watched_films_get_notes(self):
        film = self.watch_both()
        self.assertEqual(self.run_people(), (2, 2))
        self.assertEqual(film.fm['directors'], ['[[Jordan Peele]]'])
        self.assertEqual((film.fm['writers'], film.fm['writer_jobs']), (['[[Jordan Peele]]'], ['Screenplay, Story']))
        self.assertEqual((film.fm['cast'], film.fm['cast_roles']),
                         (['[[Daniel Kaluuya]]', '[[Jordan Peele]]'], ['Chris Washington', 'Wounded Deer (voice)']))
        self.assertEqual(film.fm['credits_fetched'], '2026-10-08')
        self.assertEqual(self.notes(), ['Daniel Kaluuya.md', 'Jordan Peele.md'])
        with open(os.path.join(self.dir, 'Jordan Peele.md'), encoding='utf-8') as fh:
            note = fh.read()
        self.assertIn('Type: "Person"\nAlias: "Jordan Peele"\ntmdb_person_id: 2\nknown_for: "Directing"\n', note)
        self.assertIn('await dv.view("99_Internal/Views/person-films")', note)
        self.assertEqual(self.logs, [('INFO', 'created 2 person notes; credits fetched for 2 films')])

    def test_a_person_on_one_counted_film_gets_a_link_but_no_note_until_a_second(self):
        film = self.store.upsert('Get Out', 2017, tmdb_id=419430)
        self.store.add_watch(film, '2026-10-04', rating=9, guid='1')
        other = self.store.upsert('Nope', 2022, tmdb_id=762504)
        self.store.set_pending(other, True)                     # pending only: does not count
        self.credits.update({'/movie/419430/credits': GET_OUT, '/movie/762504/credits': NOPE})
        self.assertEqual(self.run_people(), (2, 0))
        self.assertEqual(film.fm['cast'][0], '[[Daniel Kaluuya]]')
        self.assertEqual(self.notes(), [])
        self.store.set_watchlist(other, True)                   # a watchlist film counts like a watched one
        self.people = pp.People(self.dir, self.index)           # a later run, from the saved index
        self.assertEqual(self.run_people(), (0, 2))
        self.assertEqual(self.notes(), ['Daniel Kaluuya.md', 'Jordan Peele.md'])

    def test_two_people_with_one_name_get_distinct_files_and_aliased_links(self):
        a = {'id': 10, 'name': 'Chris Evans', 'photo': None, 'dept': 'Acting'}
        b = {'id': 11, 'name': 'Chris Evans', 'photo': None, 'dept': 'Acting'}
        self.assertEqual(self.people.link(a), '[[Chris Evans]]')
        self.assertEqual(self.people.link(b), '[[Chris Evans (tmdb-11)|Chris Evans]]')
        self.assertEqual(self.people.link(a), '[[Chris Evans]]')    # stable on a second sighting

    def test_a_failed_fetch_is_retried_next_run_and_blocks_nothing(self):
        bad = self.store.upsert('Bad', 2020, tmdb_id=1)
        good = self.store.upsert('Get Out', 2017, tmdb_id=419430)
        self.credits.update({'/movie/1/credits': OSError('timeout'), '/movie/419430/credits': GET_OUT})
        self.assertEqual(self.run_people()[0], 1)
        self.assertNotIn('credits_fetched', bad.fm)
        self.assertIn('credits_fetched', good.fm)
        self.assertEqual(self.logs[0], ('WARN', 'credits failed for Bad: timeout'))

    def test_a_second_run_fetches_nothing_writes_nothing_and_says_nothing(self):
        self.watch_both()
        self.run_people()
        with open(os.path.join(self.dir, 'Jordan Peele.md'), 'a', encoding='utf-8') as fh:
            fh.write('my note\n')                               # hand edits to a person note are left alone
        self.logs.clear()
        self.credits.clear()                                    # any fetch would now raise KeyError
        self.assertEqual(self.run_people(), (0, 0))
        self.assertEqual(self.logs, [])
        with open(os.path.join(self.dir, 'Jordan Peele.md'), encoding='utf-8') as fh:
            self.assertTrue(fh.read().endswith('my note\n'))

    def test_no_response_from_tmdb_is_not_recorded_as_no_credits(self):
        film = self.store.upsert('Get Out', 2017, tmdb_id=419430)
        self.credits['/movie/419430/credits'] = None            # what tmdb() gives for a 404 or after rate-limit retries
        self.assertEqual(self.run_people(), (0, 0))
        self.assertNotIn('credits_fetched', film.fm)
        self.assertEqual(self.on_disk(film).get('credits_tried'), '2026-10-08')
        self.credits['/movie/419430/credits'] = GET_OUT
        self.assertEqual(self.run_people('2026-10-09')[0], 1)
        self.assertEqual(film.fm['credits_fetched'], '2026-10-09')
        self.assertNotIn('credits_tried', self.on_disk(film))

    def test_a_film_without_credits_is_asked_about_once_a_day(self):
        film = self.store.upsert('Get Out', 2017, tmdb_id=419430)
        self.credits['/movie/419430/credits'] = None
        self.run_people()
        self.credits.clear()                                    # any fetch would now raise KeyError
        self.assertEqual(self.run_people(), (0, 0))             # the same day: not asked again
        self.credits['/movie/419430/credits'] = None
        self.run_people('2026-10-09')                           # the next day: asked, still nothing
        self.assertEqual(self.on_disk(film).get('credits_tried'), '2026-10-09')
        self.assertNotIn('credits_fetched', film.fm)

    def test_an_empty_credits_answer_is_not_final(self):
        film = self.store.upsert('Far Off', 2027, tmdb_id=5)
        self.credits['/movie/5/credits'] = {'cast': [], 'crew': []}     # listed months ahead: TMDB has nobody yet
        self.assertEqual(self.run_people(), (0, 0))
        saved = self.on_disk(film)
        self.assertNotIn('credits_fetched', saved)
        self.assertEqual(saved.get('credits_tried'), '2026-10-08')
        self.credits.clear()
        self.assertEqual(self.run_people(), (0, 0))             # the same day: not asked again
        self.credits['/movie/5/credits'] = GET_OUT
        self.assertEqual(self.run_people('2026-10-09')[0], 1)
        saved = self.on_disk(film)
        self.assertEqual(saved['credits_fetched'], '2026-10-09')
        self.assertNotIn('credits_tried', saved)
        self.assertEqual(saved['directors'], ['[[Jordan Peele]]'])

    def test_a_missing_index_is_an_empty_one(self):
        self.assertEqual(pp.People(self.dir, os.path.join(self.tmp.name, 'Data', 'nope.json')).index, {})

    def test_an_index_that_cannot_be_parsed_raises_instead_of_being_forgotten(self):
        os.makedirs(os.path.dirname(self.index))
        with open(self.index, 'w', encoding='utf-8') as fh:
            fh.write('{"1": {"stem": "Daniel Kal')              # cut short
        with self.assertRaises(ValueError) as caught:
            pp.People(self.dir, self.index)
        self.assertIn(self.index, str(caught.exception))
        with open(self.index, encoding='utf-8') as fh:
            self.assertEqual(fh.read(), '{"1": {"stem": "Daniel Kal')       # left for a person to look at

    def test_people_writes_leave_no_temp_files(self):
        self.watch_both()
        seen, real = [], os.replace
        os.replace = lambda src, dst: seen.append(src) or real(src, dst)
        try:
            self.run_people()
        finally:
            os.replace = real
        self.assertTrue(seen and all(src.endswith(f'.{os.getpid()}.tmp') for src in seen), seen)
        self.assertEqual(self.notes(), ['Daniel Kaluuya.md', 'Jordan Peele.md'])
        self.assertEqual(os.listdir(os.path.dirname(self.index)), ['people-index.json'])

    def test_the_index_is_on_disk_before_the_film_note_that_links_to_it(self):
        self.store.upsert('Get Out', 2017, tmdb_id=419430)
        self.store.upsert('Zzz', 2020, tmdb_id=2)
        self.credits['/movie/419430/credits'] = GET_OUT
        self.credits['/movie/2/credits'] = {'cast': [], 'crew': 'garbage'}      # makes the run die on the second film
        with self.assertRaises(AttributeError):
            self.run_people()
        saved = pp.People(self.dir, self.index).index
        self.assertEqual(sorted(saved), ['1', '2'])             # Daniel Kaluuya and Jordan Peele, linked from the first film's note

    def test_film_without_a_tmdb_id_is_skipped(self):
        self.store.upsert('Band of Brothers', 2001)
        self.assertEqual(self.run_people(), (0, 0))


if __name__ == '__main__':
    unittest.main()
