#!/usr/bin/env python3
"""One note per film: the only code that reads or writes 50_Personal/Letterboxd/Films/.

A film note's frontmatter records everything that has happened to the film: each
watch (`watches`, with `ratings` and `letterboxd_guids` in step), whether it is on
the watchlist or pending, and every day it was recommended or listed as upcoming.
Status is several independent fields, since a film can be watched, back on the
watchlist and recommended at once.

Scripts own the keys in ORDER and the body region between the credits markers, and
they insert a section under "## Watches" for each new watch. Every other frontmatter
line and all other body text is kept as found, so hand edits survive.

Films are found by (tmdb_type, tmdb_id), then Letterboxd slug, then normalized
title + year (TV series logged in the diary carry no TMDB id).
"""
from __future__ import annotations

import contextlib
import fcntl
import json
import os
import re
import unicodedata
from datetime import date

FILMS_REL = '50_Personal/Letterboxd/Films'
SHOWS_REL = '50_Personal/Serializd/Shows'      # TV shows from Serializd (serializd_sync.py): the same note format, Type "Show"
ILLEGAL_RE = re.compile(r'[/\\:*?"<>|#^\[\]]')
DATE_RE = re.compile(r'^\d{4}-\d{2}-\d{2}$')
NUM_RE = re.compile(r'^-?\d+(\.\d+)?$')
KEY_RE = re.compile(r'^([A-Za-z_][\w-]*):(.*)$')
ITEM_RE = re.compile(r'^\s*-\s?(.*)$')
FM_RE = re.compile(r'^---\n(.*?)\n---[ \t]*(?:\n|$)(.*)$', re.S)
CREDITS_START, CREDITS_END = '%% credits:start %%', '%% credits:end %%'
CREDITS_VIEW = '```dataviewjs\nawait dv.view("99_Internal/Views/film-credits")\n```'     # renders the credits keys as photo cards
WATCHES_HEAD = '## Watches'
ORDER = ['Type', 'Alias', 'title', 'year', 'tmdb_id', 'tmdb_type', 'letterboxd_slug', 'letterboxd_url', 'serializd_url', 'poster',
         'watches', 'ratings', 'letterboxd_guids', 'watch_count', 'last_watched', 'rating',
         'on_watchlist', 'watchlist_added', 'watching', 'watching_added', 'pending', 'pending_added', 'recommended', 'upcoming',
         'directors', 'writers', 'writer_jobs', 'cast', 'cast_roles', 'credits_fetched', 'credits_tried',
         'added', 'score_day', 'lb_rating', 'rt_score', 'rt_audience', 'rt_url', 'imdb_rating', 'imdb_url', 'scores_checked']
OWNED = set(ORDER)
LOCK_FILE = os.path.expanduser('~/Library/Application Support/letterboxd-sync/films.lock')


class Busy(Exception):
    """Another process holds the film notes lock."""


@contextlib.contextmanager
def lock(blocking=True):
    """One writer of film and person notes at a time, across the Python jobs.

    Each job loads every note at its start and writes whole notes from memory, so two of them
    running together overwrite each other. blocking=False raises Busy rather than wait.

    Taken only by the entry points: letterboxd_daily.main, movie_recs.record_films, and the
    __main__ blocks of people.py, scores.py and letterboxd_watchlist.py. The functions those call
    (people.run, scores.refresh, sync_watchlist, enrich, forget_rated) must not take it again:
    a second flock in the same process, on its own descriptor, would wait on the first forever.
    """
    os.makedirs(os.path.dirname(LOCK_FILE), exist_ok=True)
    with open(LOCK_FILE, 'a') as fh:
        try:
            fcntl.flock(fh, fcntl.LOCK_EX if blocking else fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise Busy(f'{LOCK_FILE} is held by another process') from None
        try:
            yield
        finally:
            fcntl.flock(fh, fcntl.LOCK_UN)


def norm(s):
    s = unicodedata.normalize('NFKD', s or '')
    s = ''.join(c for c in s if not unicodedata.combining(c)).lower().replace('&', 'and')
    return ' '.join(re.sub(r'[^a-z0-9]+', ' ', s).split())


def safe_name(s):
    """Filename rule: characters that are illegal in filenames or that break [[wikilinks]] (# ^ [ ]) are stripped, not replaced."""
    return ILLEGAL_RE.sub('', s).strip().strip('.')


def stars(rating10):
    """8 -> '★★★★', 9 -> '★★★★½'. Ratings are Letterboxd's 0-5 doubled."""
    if not rating10:
        return ''
    return '★' * (int(rating10) // 2) + ('½' if int(rating10) % 2 else '')


# ── frontmatter values ──────────────────────────────────────────────────────
def _scalar(tok):
    tok = tok.strip()
    if tok in ('', 'null', '~'):
        return None
    if tok in ('true', 'false'):
        return tok == 'true'
    if tok[0] == '"' and tok[-1] == '"' and len(tok) > 1:
        try:
            return json.loads(tok)
        except ValueError:
            return tok[1:-1]
    if tok[0] == "'" and tok[-1] == "'" and len(tok) > 1:
        return tok[1:-1].replace("''", "'")
    if NUM_RE.match(tok):
        return float(tok) if '.' in tok else int(tok)
    return tok


def _split(inner):
    """Split a flow list on its top-level commas; quotes and [[wikilinks]] may contain commas."""
    out, cur, quote, depth, esc = [], '', '', 0, False
    for ch in inner:
        if esc:
            cur, esc = cur + ch, False
            continue
        if quote:
            if ch == '\\' and quote == '"':
                esc = True
            elif ch == quote:
                quote = ''
        elif ch in '"\'':
            quote = ch
        elif ch == '[':
            depth += 1
        elif ch == ']':
            depth -= 1
        elif ch == ',' and depth == 0:
            out.append(cur)
            cur = ''
            continue
        cur += ch
    if cur.strip():
        out.append(cur)
    return out


def parse_value(s):
    s = s.strip()
    if s.startswith('[') and s.endswith(']') and not s.startswith('[['):
        return [_scalar(t) for t in _split(s[1:-1])]
    return _scalar(s)


def emit(v, in_list=False):
    if v is None:
        return 'null' if in_list else ''
    if isinstance(v, bool):
        return 'true' if v else 'false'
    if isinstance(v, (int, float)):
        return str(v)
    if isinstance(v, list):
        return '[' + ', '.join(emit(x, True) for x in v) + ']'
    v = str(v)
    return v if DATE_RE.match(v) else json.dumps(v, ensure_ascii=False)


# ── body pieces ─────────────────────────────────────────────────────────────
def new_body(title, year, poster=None):
    head = f'# {title} ({year})' if year else f'# {title}'
    art = f'![Poster]({poster})\n\n' if poster else ''
    return f'\n{head}\n\n{art}{CREDITS_START}\n{CREDITS_END}\n\n{WATCHES_HEAD}\n'


def watch_section(day, rating=None, url='', review='', rewatch=False, label='Letterboxd entry', what=''):
    """what: shown after the date, e.g. a show's episode ("S01E05 House of Dog")."""
    head = f'### {day}' + (f' {what}' if what else '') + (f' {stars(rating)}' if rating else '') + (' (rewatch)' if rewatch else '')
    lines = [head, '']
    if review and review.strip():
        lines += [('> ' + ln).rstrip() for ln in review.strip().split('\n')] + ['']
    if url:
        lines += [f'[{label}]({url})', '']
    return '\n'.join(lines)


def insert_watch(body, section):
    """Put a watch section first under '## Watches', adding the heading when the note has none."""
    if WATCHES_HEAD not in body:
        body = body.rstrip('\n') + f'\n\n{WATCHES_HEAD}\n'
    head, _, rest = body.partition(WATCHES_HEAD)
    rest = rest.lstrip('\n')
    return f'{head}{WATCHES_HEAD}\n\n{section}' + (f'\n{rest}' if rest else '')


def replace_credits(body, content):
    # Content gets a blank line on each side, without which Obsidian does not render it; the empty block stays adjacent (films-lib.js writes it so).
    block = f'{CREDITS_START}\n\n{content}\n\n{CREDITS_END}' if content else f'{CREDITS_START}\n{CREDITS_END}'
    if CREDITS_START in body and CREDITS_END in body:
        head, _, rest = body.partition(CREDITS_START)
        return head + block + rest.partition(CREDITS_END)[2]
    if WATCHES_HEAD in body:
        head, _, rest = body.partition(WATCHES_HEAD)
        return f'{head}{block}\n\n{WATCHES_HEAD}{rest}'
    return body.rstrip('\n') + f'\n\n{block}\n'


def link(stem, display=None):
    return f'[[{stem}|{display}]]' if display and display != stem else f'[[{stem}]]'


def watch_triples(fm):
    """[(day, rating, guid)] for a note, padding ratings and guids when a hand edit left them shorter than watches."""
    watches = fm.get('watches') or []
    ratings = list(fm.get('ratings') or [])[:len(watches)]
    guids = list(fm.get('letterboxd_guids') or [])[:len(watches)]
    ratings += [None] * (len(watches) - len(ratings))
    guids += [''] * (len(watches) - len(guids))
    return list(zip(watches, ratings, guids))


# ── one note ────────────────────────────────────────────────────────────────
class Film:
    def __init__(self, path, fm=None, extra=None, body=''):
        self.path, self.fm, self.extra, self.body = path, fm or {}, extra or [], body

    @classmethod
    def load(cls, path):
        with open(path, encoding='utf-8') as fh:
            text = fh.read()
        m = FM_RE.match(text)
        if not m:
            return cls(path, {}, [], text)
        fm, extra, key, block = {}, [], None, False
        for line in m.group(1).split('\n'):
            k = KEY_RE.match(line)
            if k and k.group(1) in OWNED:
                key = k.group(1)
                fm[key] = parse_value(k.group(2))
                block = fm[key] is None
                continue
            item = ITEM_RE.match(line)
            if item and key and block:
                # A block list ("key:" then "- value" lines), as Obsidian's Properties editor writes them.
                fm[key] = (fm[key] or []) + [_scalar(item.group(1))]
                continue
            key = None
            extra.append(line)
        return cls(path, fm, extra, m.group(2))

    def reload(self):
        """Take the note as it is on disk now, dropping unsaved changes.

        -> False (film untouched) when the file is gone or has no frontmatter keys: a writer that truncates
        before it writes (Obsidian) can be caught between the two, and saving that would replace the note with a stub.
        """
        try:
            fresh = Film.load(self.path)
        except OSError:
            return False
        if not fresh.fm:
            return False
        self.fm, self.extra, self.body = fresh.fm, fresh.extra, fresh.body
        return True

    def derive(self):
        f = self.fm
        watches = f.get('watches') or []
        f['watch_count'] = len(watches)
        f['last_watched'] = max(watches) if watches else None
        rated = [(d, r) for d, r, _ in watch_triples(f) if r is not None]
        f['rating'] = sorted(rated, key=lambda x: x[0])[-1][1] if rated else None

    def text(self):
        self.derive()
        lines = ['---'] + [f'{k}: {emit(self.fm[k])}'.rstrip() for k in ORDER if k in self.fm] + self.extra + ['---']
        return '\n'.join(lines) + '\n' + self.body

    def save(self):
        """Write the note if it changed (temp file, then rename). -> True when written."""
        text = self.text()
        try:
            with open(self.path, encoding='utf-8') as fh:
                if fh.read() == text:
                    return False
        except OSError:
            pass
        os.makedirs(os.path.dirname(self.path), exist_ok=True)
        tmp = f'{self.path}.{os.getpid()}.tmp'             # per process: two jobs saving one note must not share it
        with open(tmp, 'w', encoding='utf-8') as fh:
            fh.write(text)
        os.replace(tmp, self.path)
        return True

    @property
    def kind(self):
        return self.fm.get('tmdb_type') or 'movie'


# ── the folder ──────────────────────────────────────────────────────────────
class Store:
    def __init__(self, folder):
        self.folder = folder
        self.films, self.by_tmdb, self.by_slug, self.by_key = [], {}, {}, {}
        self.guids, self.names = set(), set()
        os.makedirs(folder, exist_ok=True)
        for name in sorted(os.listdir(folder)):
            if name.endswith('.md') and not name.startswith('.'):
                self._index(Film.load(os.path.join(folder, name)))

    def _index(self, film):
        f = film.fm
        if film not in self.films:
            self.films.append(film)
        if f.get('tmdb_id'):
            self.by_tmdb[(film.kind, int(f['tmdb_id']))] = film
        if f.get('letterboxd_slug'):
            self.by_slug[str(f['letterboxd_slug'])] = film
        if f.get('title'):
            self.by_key.setdefault((norm(str(f['title'])), f.get('year')), film)
        self.guids.update(str(g) for g in f.get('letterboxd_guids') or [] if g)
        self.names.add(os.path.basename(film.path).lower())

    def find(self, tmdb_id=None, tmdb_type='movie', slug=None, title=None, year=None):
        if tmdb_id:
            hit = self.by_tmdb.get((tmdb_type or 'movie', int(tmdb_id)))
            if hit:
                return hit
        if slug and str(slug) in self.by_slug:
            return self.by_slug[str(slug)]
        if title:
            hit = self.by_key.get((norm(title), year))
            # A title match must not join two films TMDB tells apart.
            if hit and not (tmdb_id and hit.fm.get('tmdb_id')):
                return hit
        return None

    def upsert(self, title, year, tmdb_id=None, tmdb_type='movie', slug=None, url=None, poster=None,
               today=None, score_day=None):
        """The film's note, created when there is none. Fills identity fields that are still empty."""
        today = today or date.today().isoformat()
        film = self.find(tmdb_id, tmdb_type, slug, title, year)
        if film is None:
            stem = safe_name(f'{title} ({year})' if year else title) or 'Untitled'
            if f'{stem}.md'.lower() in self.names:
                stem = f'{stem} (tmdb-{tmdb_id})' if tmdb_id else f'{stem} ({len(self.names)})'
            film = Film(os.path.join(self.folder, f'{stem}.md'), {
                'Type': 'Film', 'Alias': title, 'title': title, 'year': year,
                'watches': [], 'ratings': [], 'letterboxd_guids': [],
                'on_watchlist': False, 'pending': False, 'recommended': [], 'upcoming': [],
                'added': today,
                'score_day': date.fromisoformat(today).weekday() if score_day is None else score_day,
            }, [], new_body(title, year))
        f = film.fm
        if tmdb_id and not f.get('tmdb_id'):
            f['tmdb_id'], f['tmdb_type'] = int(tmdb_id), tmdb_type or 'movie'
        if slug and not f.get('letterboxd_slug'):
            f['letterboxd_slug'] = slug
        if url and (not f.get('letterboxd_url') or '/tmdb/' in f['letterboxd_url'] and '/tmdb/' not in url):
            f['letterboxd_url'] = url
        if not f.get('letterboxd_url') and f.get('tmdb_id') and film.kind == 'movie':
            f['letterboxd_url'] = f"https://letterboxd.com/tmdb/{int(f['tmdb_id'])}/"     # redirects to the film page
        if poster:
            self.set_poster(film, poster)
        self._index(film)
        return film

    def set_tmdb(self, film, tmdb_id, tmdb_type='movie'):
        """-> False (and no change) when another note already has that id."""
        other = self.by_tmdb.get((tmdb_type, int(tmdb_id)))
        if other is not None and other is not film:
            return False
        film.fm['tmdb_id'], film.fm['tmdb_type'] = int(tmdb_id), tmdb_type
        self._index(film)
        return True

    def set_slug(self, film, slug):
        """Letterboxd renamed the film's slug: take the new one, and its URL, and stop answering to the old."""
        old = film.fm.get('letterboxd_slug')
        if old and self.by_slug.get(str(old)) is film:
            del self.by_slug[str(old)]
        film.fm['letterboxd_slug'], film.fm['letterboxd_url'] = slug, f'https://letterboxd.com/film/{slug}/'
        self._index(film)

    def set_poster(self, film, url):
        if film.fm.get('poster'):
            return
        film.fm['poster'] = url
        if '![Poster](' not in film.body:
            head, sep, rest = film.body.partition('\n\n')          # after the "# Title (Year)" line
            film.body = f'{head}\n\n![Poster]({url})\n\n{rest}' if sep else film.body + f'\n![Poster]({url})\n'

    def add_watch(self, film, day, rating=None, guid='', url='', review='', rewatch=False, dedupe=True, label='Letterboxd entry', what=''):
        """Record one viewing. -> False when it is already there (same guid, or same day for a guid-less entry)."""
        f, guid = film.fm, str(guid or '')
        if guid and guid in self.guids:
            return False
        if dedupe and not guid and day in (f.get('watches') or []):
            return False
        rows = watch_triples(f)
        rows.append((day, rating, guid))
        rows.sort(key=lambda r: r[0])                               # stable: same-day watches keep their order
        f['watches'], f['ratings'], f['letterboxd_guids'] = (list(col) for col in zip(*rows))
        if guid:
            self.guids.add(guid)
        film.body = insert_watch(film.body, watch_section(day, rating, url, review, rewatch, label, what))
        return True

    def set_watchlist(self, film, on, added=None):
        film.fm['on_watchlist'] = bool(on)
        if on and not film.fm.get('watchlist_added'):
            film.fm['watchlist_added'] = added or date.today().isoformat()

    def set_pending(self, film, on, added=None):
        film.fm['pending'] = bool(on)
        if on and not film.fm.get('pending_added'):
            film.fm['pending_added'] = added or date.today().isoformat()

    def _add_day(self, film, key, day):
        days = film.fm.get(key) or []
        if day not in days:
            film.fm[key] = sorted(days + [day])

    def add_recommended(self, film, day):
        self._add_day(film, 'recommended', day)

    def add_upcoming(self, film, monday):
        self._add_day(film, 'upcoming', monday)

    def set_scores(self, film, lb=None, rt=None, aud=None, rt_url=None, today=None, imdb=None, imdb_url=None):
        """A score that could not be read (None) leaves the stored value alone."""
        got = False
        for key, val in (('lb_rating', lb), ('rt_score', rt), ('rt_audience', aud), ('rt_url', rt_url),
                         ('imdb_rating', imdb), ('imdb_url', imdb_url)):
            if val is not None:
                film.fm[key] = val
                got = got or key not in ('rt_url', 'imdb_url')
        if got:
            film.fm['scores_checked'] = today or date.today().isoformat()

    def set_credits(self, film, directors, writers, cast, today=None):
        """directors: [link]; writers: [(link, jobs)]; cast: [(link, character)], in billing order."""
        f = film.fm
        f['directors'] = list(directors)
        f['writers'], f['writer_jobs'] = [w for w, _ in writers], [j for _, j in writers]
        f['cast'], f['cast_roles'] = [c for c, _ in cast], [r for _, r in cast]
        f['credits_fetched'] = today or date.today().isoformat()
        film.body = replace_credits(film.body, CREDITS_VIEW if directors or writers or cast else '')

    def watch_rows(self):
        """One dict per viewing, the shape the recommender's diary readers expect."""
        for film in self.films:
            f = film.fm
            for day, rating, _ in watch_triples(f):
                yield {'title': f.get('title') or '', 'year': f.get('year'),
                       'tmdb_id': int(f['tmdb_id']) if f.get('tmdb_id') and film.kind == 'movie' else None,
                       'rating': rating, 'watched': str(day)}
