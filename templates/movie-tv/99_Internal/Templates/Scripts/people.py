#!/usr/bin/env python3
"""Cast and crew for film notes, and one note per person.

For every film note that has a TMDB id and no `credits_fetched` yet, fetch its credits and write
the directors, the writers and the top CAST_DEPTH billed actors onto the film note, as links with
their role. A film TMDB has nobody for yet is stamped `credits_tried` and asked about once a day. A person's own note is thin (name, photo, department, and a view that lists their
films), so nothing is ever written to it when a film changes.

Person notes are created only for people credited on at least MIN_FILMS films that are watched or
on the watchlist. Everyone else is still listed on the film as a link; it resolves once they reach
that many.
99_Internal/Data/people-index.json remembers each person's filename from the first time
they are seen, so those early links stay valid.

Called by letterboxd_daily.py and movie_recs.py; `people.py` on its own does one pass.
"""
from __future__ import annotations

import json
import os
import re
import sys
from datetime import date

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from film_store import link, safe_name  # noqa: E402

PEOPLE_REL = '50_Personal/Letterboxd/People'
INDEX_REL = '99_Internal/Data/people-index.json'
CAST_DEPTH = 25
MIN_FILMS = 2                               # watched or watchlist films a person must be credited on to get a note
PHOTO = 'https://image.tmdb.org/t/p/w185'
LINK_RE = re.compile(r'\[\[([^\]|]+)')


class People:
    def __init__(self, folder, index_path):
        self.folder, self.index_path = folder, index_path
        try:
            with open(index_path, encoding='utf-8') as fh:
                self.index = json.load(fh)                  # person id (str) -> {stem, name, photo, dept}
        except FileNotFoundError:
            self.index = {}
        except (OSError, ValueError) as exc:                # starting over would forget every filename already handed out
            raise ValueError(f'people index {index_path} cannot be read: {exc}') from exc
        self.stems = {v['stem'].lower(): k for k, v in self.index.items()}
        os.makedirs(folder, exist_ok=True)
        self.on_disk = {n.lower() for n in os.listdir(folder)}
        self.dirty = False

    def stem(self, person):
        """The person's filename (without .md), assigned the first time they are seen."""
        pid = str(person['id'])
        if pid not in self.index:
            stem = safe_name(person['name']) or f"Person {pid}"
            if stem.lower() in self.stems:                  # someone else already has this name
                stem = f'{stem} (tmdb-{pid})'
            self.index[pid] = {'stem': stem, 'name': person['name'], 'photo': person.get('photo') or '', 'dept': person.get('dept') or ''}
            self.stems[stem.lower()] = pid
            self.dirty = True
        return self.index[pid]['stem']

    def link(self, person):
        return link(self.stem(person), person['name'])

    def ids_on(self, film):
        """Ids of the people a film note links to."""
        out = []
        for key in ('directors', 'writers', 'cast'):
            for value in film.fm.get(key) or []:
                m = LINK_RE.match(str(value))
                pid = self.stems.get(m.group(1).lower()) if m else None
                if pid and pid not in out:
                    out.append(pid)
        return out

    def ensure_note(self, pid):
        """-> True when the note was just created. An existing note is never rewritten."""
        p = self.index[pid]
        name = f"{p['stem']}.md"
        if name.lower() in self.on_disk:
            return False
        q = lambda s: json.dumps(s, ensure_ascii=False)
        lines = ['---', 'Type: "Person"', f"Alias: {q(p['name'])}", f'tmdb_person_id: {pid}',
                 f"known_for: {q(p['dept'])}" if p['dept'] else 'known_for:',
                 f"photo: {q(PHOTO + p['photo'])}" if p['photo'] else 'photo:', '---', '', f"# {p['name']}", '']
        if p['photo']:
            lines += [f"![photo|160]({PHOTO + p['photo']})", '']
        lines += ['```dataviewjs', 'await dv.view("99_Internal/Views/person-films")', '```', '']
        path = os.path.join(self.folder, name)
        tmp = f'{path}.{os.getpid()}.tmp'
        with open(tmp, 'w', encoding='utf-8') as fh:
            fh.write('\n'.join(lines))
        os.replace(tmp, path)
        self.on_disk.add(name.lower())
        return True

    def save(self):
        if not self.dirty:
            return
        os.makedirs(os.path.dirname(self.index_path), exist_ok=True)
        tmp = f'{self.index_path}.{os.getpid()}.tmp'
        with open(tmp, 'w', encoding='utf-8') as fh:
            json.dump(self.index, fh, ensure_ascii=False, indent=0, sort_keys=True)
        os.replace(tmp, self.index_path)
        self.dirty = False


def _person(p):
    return {'id': p['id'], 'name': ' '.join(str(p.get('name') or '').split()), 'photo': p.get('profile_path'), 'dept': p.get('known_for_department')}


def _episodes(c):
    """Episodes a TV crew member worked on (aggregate_credits); 0 for a film's crew."""
    return sum(j.get('episode_count') or 0 for j in c.get('jobs') or []) or c.get('total_episode_count') or 0


def split_credits(credits, depth=CAST_DEPTH, crew_cap=None):
    """TMDB credits (movie /credits or tv /aggregate_credits) -> (directors, writers, cast).

    directors: [person]; writers: [(person, 'Screenplay, Story')]; cast: [(person, character)] in billing order.
    crew_cap: for a TV show, keep only the directors and the writers with the most episodes (a long show has dozens).
    """
    directors, writers, seen = [], {}, set()
    crew = credits.get('crew') or []
    if crew_cap:
        crew = sorted(crew, key=_episodes, reverse=True)
    for c in crew:
        jobs = [c['job']] if c.get('job') else [j.get('job') for j in c.get('jobs') or []]
        if not c.get('name'):
            continue
        if 'Director' in jobs and c['id'] not in seen:
            seen.add(c['id'])
            directors.append(_person(c))
        if c.get('department') == 'Writing':
            entry = writers.setdefault(c['id'], (_person(c), []))
            entry[1].extend(j for j in jobs if j and j not in entry[1])
    if crew_cap:
        directors = directors[:crew_cap]
        writers = dict(list(writers.items())[:crew_cap])
    cast = []
    for c in sorted(credits.get('cast') or [], key=lambda c: c.get('order', 999)):
        if not c.get('name') or any(c['id'] == p['id'] for p, _ in cast):
            continue
        role = c.get('character') or ', '.join(r['character'] for r in c.get('roles') or [] if r.get('character'))
        cast.append((_person(c), ' '.join(role.split())))
        if len(cast) == depth:
            break
    return directors, [(p, ', '.join(jobs)) for p, jobs in writers.values()], cast


TV_CREW_CAP = 5                             # directors and writers kept per TV show, by episode count


def qualifying(stores, people, minimum=MIN_FILMS):
    """Ids of the people credited on at least `minimum` titles (films and TV shows together) that are watched,
    on a watchlist, or being watched. stores: one Store or several."""
    counts = {}
    for film in (f for s in (stores if isinstance(stores, (list, tuple)) else [stores]) for f in s.films):
        if film.fm.get('watches') or film.fm.get('on_watchlist') or film.fm.get('watching'):
            for pid in people.ids_on(film):
                counts[pid] = counts.get(pid, 0) + 1
    return [pid for pid, n in counts.items() if n >= minimum]


def run(store, tmdb, people, today=None, depth=CAST_DEPTH, log=print, also=()):
    """Fetch missing credits for `store`'s notes, then make sure everyone on MIN_FILMS watched or watchlist titles has a note.
    also: other Stores (the TV shows for a film run, the films for a TV run) whose titles count toward MIN_FILMS.
    -> (films fetched, notes created)."""
    today = today or date.today().isoformat()
    fetched = 0
    for film in store.films:
        f = film.fm
        if f.get('credits_fetched') or not f.get('tmdb_id') or str(f.get('credits_tried') or '') == today:
            continue
        path = f"/tv/{int(f['tmdb_id'])}/aggregate_credits" if film.kind == 'tv' else f"/movie/{int(f['tmdb_id'])}/credits"
        try:
            credits = tmdb(path)
        except Exception as exc:                # left without credits_fetched, so the next run tries again
            log(f"credits failed for {f.get('title')}: {exc}", 'WARN')
            continue
        directors, writers, cast = split_credits(credits, depth, TV_CREW_CAP if film.kind == 'tv' else None) if credits is not None else ([], [], [])
        if not (directors or writers or cast):  # a 404, rate-limited past the retries, or nobody listed yet: ask again, but not before tomorrow
            log(f"no credits returned for {f.get('title')}")
            f['credits_tried'] = today
            film.save()
            continue
        f.pop('credits_tried', None)
        store.set_credits(film, [people.link(p) for p in directors], [(people.link(p), jobs) for p, jobs in writers],
                          [(people.link(p), role) for p, role in cast], today)
        people.save()                           # before the note that links to them: a crash must not leave links the index cannot resolve
        film.save()
        fetched += 1
    created = sum(people.ensure_note(pid) for pid in qualifying([store, *also], people))
    people.save()
    if fetched or created:
        log(f'created {created} person notes; credits fetched for {fetched} films')
    return fetched, created


if __name__ == '__main__':
    import movie_recs as mr
    from film_store import FILMS_REL, Store, lock
    with lock():                                # run() itself takes no lock: its callers already hold this one
        run(Store(os.path.join(mr.VAULT, FILMS_REL)), mr.tmdb,
            People(os.path.join(mr.VAULT, PEOPLE_REL), os.path.join(mr.VAULT, INDEX_REL)),
            log=lambda msg, level='INFO': print(f'[{level}] {msg}', flush=True))
