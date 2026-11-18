#!/usr/bin/env python3
"""Daily movie recommendations: context for the picker, validated output for the vault.

Two subcommands, driven by the scheduled Claude task (see Scripts/movie_recs_task.md):

  movie_recs.py context        Print the taste profile, mood, candidate pools and
                               rules. The picker reads this and chooses 10 films.
  movie_recs.py write [picks]  Validate the picks (a JSON file, or stdin when no
                               file is given), resolve posters
                               from TMDB and write Data/movie-recs.json, which the
                               `movie-recs` Dataview view renders. On any rule
                               violation it prints the problems, exits 1 and leaves
                               yesterday's file untouched, so the picker can fix and retry.
                               The scheduled task passes Data/movie-recs-draft.json (removed
                               on success): that exact command is pre-approved in the vault's
                               .claude/settings.local.json, whereas JSON inside the command
                               line (heredoc) always stops on a permission prompt.

Picks shape:  {"angle": "your read of his mood", "picks": [{"title": "...", "year": 2019, "tmdb_id": 123 (optional),
                           "why": "one line"}]}

The TMDB v4 token is resolved here (env or the vault .env) and never printed.
"""
from __future__ import annotations

import json
import os
import re
import sys
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor
from datetime import date, timedelta

VAULT = os.environ.get('LETTERBOXD_VAULT', os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..')))
FILMS = os.path.join(VAULT, '50_Personal/Letterboxd/Films')   # one note per film (film_store.py)
OUT = os.path.join(VAULT, '99_Internal/Data/movie-recs.json')
HISTORY = os.path.join(VAULT, '99_Internal/Data/movie-recs-history.json')   # every pick, by day; drives the cooldown
BLOCKED = os.path.join(VAULT, '99_Internal/Data/movie-recs-blocked.json')   # written by the dashboard's "x" button
RECS_LOG = os.path.join(VAULT, '50_Personal/Letterboxd/Recs')   # one note per day, YYYY/MM/DD.md
CACHE_DIR = os.path.expanduser('~/Library/Application Support/letterboxd-sync')
GENRE_CACHE = os.path.join(CACHE_DIR, 'tmdb-movie-meta.json')

API = 'https://api.themoviedb.org/3'
IMG = 'https://image.tmdb.org/t/p/w500'
REGION = 'US'
N_PICKS = 10
MAX_QUEUE = 6          # watchlist + Pending picks, combined
MAX_PRE_1990 = 2       # 70s/80s are rare
MAX_PRE_1970 = 1       # older only occasionally
COOLDOWN_DAYS = 14     # a film picked in the last N days is not offered or accepted again
HISTORY_KEEP_DAYS = 90
MIN_HORROR_OCT = N_PICKS // 2   # October: at least half the list is horror
GENRES = {28: 'Action', 12: 'Adventure', 16: 'Animation', 35: 'Comedy', 80: 'Crime',
          99: 'Documentary', 18: 'Drama', 10751: 'Family', 14: 'Fantasy', 36: 'History',
          27: 'Horror', 10402: 'Music', 9648: 'Mystery', 10749: 'Romance',
          878: 'Sci-Fi', 53: 'Thriller', 10770: 'TV Movie', 10752: 'War', 37: 'Western'}


# ── token / TMDB ────────────────────────────────────────────────────────────
def tmdb_token():
    for var in ('TMDB_TOKEN', 'TMDB_API_KEY', 'TVDB_API_KEY'):       # .env misnames it TVDB_API_KEY
        val = os.environ.get(var, '').strip()
        if val:
            return val
    try:
        for line in open(os.path.join(VAULT, '.env'), encoding='utf-8', errors='ignore'):
            k, _, v = line.strip().partition('=')
            if k.strip() in ('TMDB_TOKEN', 'TMDB_API_KEY', 'TVDB_API_KEY') and v:
                return v.strip().strip('"').strip("'")
    except OSError:
        pass
    sys.exit('no TMDB token in env or vault .env')


TOKEN = None


def tmdb(path, **params):
    global TOKEN
    TOKEN = TOKEN or tmdb_token()
    url = f'{API}{path}?' + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={'Authorization': f'Bearer {TOKEN}',
                                               'accept': 'application/json'})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None
            if e.code == 429:
                time.sleep(2 * (attempt + 1))
                continue
            raise
        except Exception:
            if attempt == 3:
                raise
            time.sleep(1.5 * (attempt + 1))
    return None


def norm(s):
    s = unicodedata.normalize('NFKD', s or '')
    s = ''.join(c for c in s if not unicodedata.combining(c)).lower().replace('&', 'and')
    return ' '.join(re.sub(r'[^a-z0-9]+', ' ', s).split())


def year_of(date_str):
    return int(date_str[:4]) if date_str and date_str[:4].isdigit() else None


# ── vault readers ───────────────────────────────────────────────────────────
_STORE = None


def store():
    """The film notes, loaded once per run."""
    global _STORE
    if _STORE is None:
        from film_store import Store
        _STORE = Store(FILMS)
    return _STORE


def load_diary():
    """One row per viewing: {'title', 'year', 'tmdb_id', 'rating', 'watched'}. A rewatch is its own row."""
    return list(store().watch_rows())


def load_queue(label):
    """'want': films marked pending with the dashboard's "+ Obsidian"; 'watchlist': the rest of the Letterboxd watchlist."""
    rows = []
    for film in store().films:
        f = film.fm
        if not (f.get('pending') if label == 'want' else f.get('on_watchlist') and not f.get('pending')):
            continue
        rows.append({'title': f.get('title') or '', 'year': f.get('year'), 'source': label,
                     'tmdb_id': int(f['tmdb_id']) if f.get('tmdb_id') and film.kind == 'movie' else None,
                     'url': f.get('letterboxd_url') or '', 'poster': f.get('poster') or '',
                     'added': str(f.get('pending_added' if label == 'want' else 'watchlist_added') or '')})
    return rows


def load_blocked():
    try:
        return json.load(open(BLOCKED, encoding='utf-8')).get('blocked', [])
    except (OSError, ValueError):
        return []


def load_history(today):
    """[{'date','tmdb_id','title','year'}] of past picks. Seeds from the current output file the
    first time, so the cooldown works from the very next run."""
    try:
        return json.load(open(HISTORY, encoding='utf-8')).get('picks', [])
    except (OSError, ValueError):
        pass
    try:
        cur = json.load(open(OUT, encoding='utf-8'))
        return [{'date': cur['generated'], 'tmdb_id': p.get('tmdb_id'), 'title': p['title'], 'year': p.get('year')}
                for p in cur.get('picks', [])]
    except (OSError, ValueError, KeyError):
        return []


def recent_picks(today):
    """Picks inside the cooldown. Today's own are excluded so re-running today stays possible."""
    lo, hi = (today - timedelta(days=COOLDOWN_DAYS)).isoformat(), today.isoformat()
    return [h for h in load_history(today) if lo <= h.get('date', '') < hi]


def save_history(today, new_picks):
    keep = (today - timedelta(days=HISTORY_KEEP_DAYS)).isoformat()
    rows = [h for h in load_history(today) if keep <= h.get('date', '') < today.isoformat()]
    rows += [{'date': today.isoformat(), 'tmdb_id': o['tmdb_id'], 'title': o['title'], 'year': o['year']} for o in new_picks]
    tmp = HISTORY + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump({'picks': rows}, f, indent=0, ensure_ascii=False)
    os.replace(tmp, HISTORY)


class Seen:
    """Films never to recommend: the diary, plus anything he blocked with the dashboard's "x".

    Matched by TMDB id and by normalized title+year (TV entries have no id).
    """

    def __init__(self, diary):
        blocked = load_blocked()
        self.blocked_ids = {b['tmdb_id'] for b in blocked if b.get('tmdb_id')}
        self.blocked_keys = {(norm(b.get('title', '')), b.get('year')) for b in blocked}
        self.ids = {d['tmdb_id'] for d in diary if d['tmdb_id']} | self.blocked_ids
        self.keys = {(norm(d['title']), d['year']) for d in diary} | self.blocked_keys
        self.titles = Counter(norm(d['title']) for d in diary)
        self.n_blocked = len(blocked)
        rec = recent_picks(date.today())
        self.recent_ids = {h['tmdb_id'] for h in rec if h.get('tmdb_id')}
        self.recent_keys = {(norm(h['title']), h.get('year')) for h in rec}
        self.n_recent = len(rec)

    def is_recent(self, tmdb_id, title, year):
        return (tmdb_id in self.recent_ids) or (norm(title), year) in self.recent_keys

    def is_blocked(self, tmdb_id, title, year):
        return (tmdb_id in self.blocked_ids) or (norm(title), year) in self.blocked_keys

    def has(self, tmdb_id, title, year):
        """Diary, blocked, or picked within the cooldown (pools and queues skip all three)."""
        if self.is_recent(tmdb_id, title, year):
            return True
        if tmdb_id and tmdb_id in self.ids:
            return True
        n = norm(title)
        return any((n, y) in self.keys for y in (year, (year or 0) - 1, (year or 0) + 1)) if year else False


# ── metadata cache (genres for every diary film) ────────────────────────────
def load_cache():
    try:
        return {int(k): v for k, v in json.load(open(GENRE_CACHE)).items()}
    except (OSError, ValueError):
        return {}


def fill_meta(ids):
    cache = load_cache()
    todo = [i for i in ids if i not in cache]

    def one(i):
        d = tmdb(f'/movie/{i}')
        return i, ({'genres': [g['name'] for g in d.get('genres', [])],
                    'runtime': d.get('runtime')} if d else {'genres': [], 'runtime': None})
    if todo:
        with ThreadPoolExecutor(8) as ex:
            for i, meta in ex.map(one, todo):
                cache[i] = meta
        os.makedirs(CACHE_DIR, exist_ok=True)
        json.dump(cache, open(GENRE_CACHE, 'w'))
    return cache


# ── context ─────────────────────────────────────────────────────────────────
def fmt_result(r):
    g = '/'.join(GENRES.get(i, '?') for i in r.get('genre_ids', [])[:3])
    return (f"{r['id']}\t{r.get('title')}\t{year_of(r.get('release_date'))}\t"
            f"{r.get('vote_average', 0):.1f}\t{g}")


_avail = {}


def availability(tid):
    """Where he can watch it today in REGION, from TMDB's watch providers (JustWatch data).
    -> {'stream': [...], 'rent': [...], 'buy': [...]}; all empty means theaters-only or not out."""
    if tid not in _avail:
        d = ((tmdb(f'/movie/{tid}/watch/providers') or {}).get('results') or {}).get(REGION) or {}
        # Fandango At Home (ex-Vudu) lists preorders as rent/buy, so it doesn't prove the film is out
        names = lambda *keys: [p['provider_name'] for k in keys for p in d.get(k, [])
                               if 'fandango' not in p['provider_name'].lower()]
        _avail[tid] = {'stream': names('flatrate', 'free', 'ads'), 'rent': names('rent'), 'buy': names('buy')}
    return _avail[tid]


def can_watch(tid):
    return any(availability(tid).values())


def avail_tag(tid):
    a = availability(tid)
    if a['stream']:
        return 'stream'
    return 'rent/buy' if (a['rent'] or a['buy']) else ''


def avail_card(tid):
    """Compact form stored with a pick for the dashboard."""
    a = availability(tid)
    if a['stream']:
        return {'kind': 'Stream', 'on': a['stream'][:2]}
    return {'kind': 'Rent/Buy', 'on': (a['rent'] + [x for x in a['buy'] if x not in a['rent']])[:2]}


def pool(name, seen, pages, path, limit=22, **params):
    cands, ids = [], set()
    for pg in range(1, pages + 1):
        for r in (tmdb(path, page=pg, **params) or {}).get('results', []):
            y = year_of(r.get('release_date'))
            if (r['id'] in ids or not y or r.get('vote_count', 0) < 40
                    or seen.has(r['id'], r.get('title', ''), y)):
                continue
            ids.add(r['id'])
            cands.append(r)
    with ThreadPoolExecutor(8) as ex:                       # drop theaters-only and unreleased
        ok = list(ex.map(lambda r: can_watch(r['id']), cands))
    out = [fmt_result(r) + f'\t[{avail_tag(r["id"])}]' for r, k in zip(cands, ok) if k]
    print(f'\n## {name}  (tmdb_id, title, year, tmdb rating, genres, how)')
    print('\n'.join(out[:limit]) or '(none)')
    return ids


def released(rows):
    """Queue rows he can watch right now (streaming, rent or buy): the watchlist is full of
    unreleased and theaters-only films. Rows with no TMDB id are dropped; they can't be checked."""
    def one(r):
        if not r['tmdb_id']:
            return False
        d = tmdb(f"/movie/{r['tmdb_id']}")
        r['genres'] = [g['name'] for g in (d or {}).get('genres', [])]
        r['how'] = avail_tag(r['tmdb_id'])
        return bool(d) and bool(r['how'])
    with ThreadPoolExecutor(8) as ex:
        keep = list(ex.map(one, rows))
    return [r for r, k in zip(rows, keep) if k]


def build_brief(today, diary, meta, n_blocked=0, n_recent=0):
    """The selection prompt: today's rules plus what the diary says about taste and mood.

    Printed for the picker by `context` and stored verbatim in the output JSON, so the
    dashboard shows exactly what chose the films. Every line is derived from live data.
    """
    rated = [d for d in diary if d['rating']]
    recent = sorted(diary, key=lambda d: d['watched'], reverse=True)[:12]
    gof = lambda d: meta.get(d['tmdb_id'], {}).get('genres', [])

    by_genre = defaultdict(list)
    for d in rated:
        for g in gof(d):
            by_genre[g].append(d['rating'] / 2)
    fav = sorted(((sum(v) / len(v), g, len(v)) for g, v in by_genre.items() if len(v) >= 8), reverse=True)[:3]
    mix = Counter(g for d in recent for g in gof(d))
    r_avg = [d['rating'] / 2 for d in recent if d['rating']]
    all_avg = sum(d['rating'] / 2 for d in rated) / max(len(rated), 1)

    mood = []
    if mix:
        top = ', '.join(f'{g} x{n}' for g, n in mix.most_common(3))
        mood.append(f'Last {len(recent)} watches skew {top}.')
        g1, n1 = mix.most_common(1)[0]
        if n1 >= 5:
            if today.month == 10:
                mood.append(f'That is a {g1} streak, but October horror takes at least half the list; use the streak for the non-horror picks.')
            else:
                mood.append(f'That is a {g1} streak: keep it going with the best of it, but let at most 2 picks contrast.')
        else:
            mood.append('No single-genre streak: mix moods instead of following one.')
    if r_avg:
        avg = sum(r_avg) / len(r_avg)
        if avg <= all_avg - 0.3:
            mood.append(f'Recent ratings are low ({avg:.1f}★ vs {all_avg:.1f}★ overall): he is not finding what he wants, so favour safer, higher-consensus picks.')
        elif avg >= all_avg + 0.3:
            mood.append(f'Recent ratings are high ({avg:.1f}★ vs {all_avg:.1f}★ overall): he is on a hot streak, so stay close to what just worked.')
        else:
            mood.append(f'Recent ratings are normal ({avg:.1f}★ vs {all_avg:.1f}★ overall).')

    season = {10: f'October is horror month: at least {MIN_HORROR_OCT} of the {N_PICKS} picks must be horror (more is fine), '
                  'varied across subgenres (slasher, folk, supernatural, creature, psychological, horror-comedy) and eras within the era caps, '
                  'weighted to his well-rated horror anchors and the queues. Pair them with non-horror picks that fit his mood for balance. '
                  'Horror counts toward the queue cap like any other pick.',
              12: 'December: one cozy or holiday-season pick is welcome (advisory).'}.get(
        today.month, 'No seasonal rule this month.')

    return '\n'.join([
        f'Pick {N_PICKS} films for {today:%A %B %-d, %Y} for one person, from his Letterboxd diary.',
        f'Season: {season}',
        'Taste: ' + (', '.join(f'{g} ({a:.2f}★ over {n} films)' for a, g, n in fav) or 'not enough data')
        + '. His 4.5-5★ films are the anchors; avoid what resembles his 2★-or-lower films.',
        'Mood: ' + (' '.join(mood) or 'no recent watches.'),
        'Availability: only films he can watch today in the US: streaming (subscription or free), rent or buy. '
        'Never anything that is only in theaters or coming soon; the lists below are already filtered and marked [stream] or [rent/buy].',
        f'Queues: Watchlist + Pending are prioritized (Pending first) but capped at {MAX_QUEUE} of {N_PICKS} combined; '
        'released films only. The rest is discovery: new releases, streaming now, trending, or taste-matched finds.',
        f'Era: mostly 2000+, the 1990s fine, at most {MAX_PRE_1990} from before 1990, at most {MAX_PRE_1970} from before 1970.',
        'Never recommend anything already in his diary' + (f' or any of the {n_blocked} films he blocked with the x button (already filtered out of every list; do not suggest them from memory either).' if n_blocked else '.'),
        f'Variety: the {n_recent} films recommended in the last {COOLDOWN_DAYS} days are already filtered out of every list and rejected by write; '
        'do not repeat them, and vary genre, era and tone from the previous days rather than re-picking the same obvious titles.' if n_recent else
        'Variety: vary genre, era and tone; avoid the obvious defaults.',
        'Each "why": one specific line (<= 110 chars) tied to his diary, no spoilers, no filler.',
    ])


def cmd_context():
    today = date.today()
    diary = load_diary()
    seen = Seen(diary)
    meta = fill_meta([d['tmdb_id'] for d in diary if d['tmdb_id']])
    rated = [d for d in diary if d['rating']]

    print(f'# Context for {today.isoformat()}  (month={today:%B})')
    print(f'Diary: {len(diary)} entries, {len(rated)} rated. Never recommend any of them.')

    hist = Counter(d['rating'] / 2 for d in rated)
    print('\n## Rating histogram (stars: count)')
    print(', '.join(f'{k:g}:{hist[k]}' for k in sorted(hist)))

    print('\n## Loved (4.5+ stars) — taste anchors')
    loved = {}
    for d in sorted((d for d in rated if d['rating'] >= 9), key=lambda d: d['watched'], reverse=True):
        loved.setdefault((d['title'], d['year']), d)       # rewatches appear once
    for d in list(loved.values())[:40]:
        print(f"- {d['title']} ({d['year']}) {d['rating']/2:g}★ "
              f"[{'/'.join(meta.get(d['tmdb_id'], {}).get('genres', [])[:3])}]")
    print('\n## Disliked (2 stars or less)')
    for d in sorted((d for d in rated if d['rating'] <= 4), key=lambda d: d['watched'], reverse=True)[:15]:
        print(f"- {d['title']} ({d['year']}) {d['rating']/2:g}★")

    by_genre = defaultdict(list)
    for d in rated:
        for g in meta.get(d['tmdb_id'], {}).get('genres', []):
            by_genre[g].append(d['rating'] / 2)
    print('\n## Genre affinity (avg stars, count) — min 5 films')
    for g, v in sorted(by_genre.items(), key=lambda kv: -sum(kv[1]) / len(kv[1])):
        if len(v) >= 5:
            print(f'- {g}: {sum(v)/len(v):.2f} ({len(v)})')

    by_decade = defaultdict(list)
    for d in rated:
        if d['year']:
            by_decade[d['year'] // 10 * 10].append(d['rating'] / 2)
    print('\n## Decade (avg stars, count)')
    print(', '.join(f'{k}s: {sum(v)/len(v):.2f} ({len(v)})' for k, v in sorted(by_decade.items())))

    recent = sorted(diary, key=lambda d: d['watched'], reverse=True)[:12]
    print('\n## Watched lately (mood), newest first')
    for d in recent:
        r = f"{d['rating']/2:g}★" if d['rating'] else 'unrated'
        print(f"- {d['watched']}  {d['title']} ({d['year']}) {r} "
              f"[{'/'.join(meta.get(d['tmdb_id'], {}).get('genres', [])[:3])}]")
    gc = Counter(g for d in recent for g in meta.get(d['tmdb_id'], {}).get('genres', []))
    print('Recent genre mix:', ', '.join(f'{g} x{n}' for g, n in gc.most_common(6)))

    for label, name in (('watchlist', 'Letterboxd watchlist'),
                        ('want', 'Pending (hand-picked via "+ Obsidian"; treat like watchlist, higher intent)')):
        rows = [r for r in load_queue(label) if not seen.has(r['tmdb_id'], r['title'], r['year'])]
        live = released(rows)
        print(f'\n## {name} — {len(live)} unseen and watchable now  (tmdb_id, title, year, genres, how, added)')
        for r in sorted(live, key=lambda r: r['added'], reverse=True):
            print(f"{r['tmdb_id'] or '-'}\t{r['title']}\t{r['year']}\t{'/'.join(r['genres'][:3])}\t[{r['how']}]\t{r['added']}")

    print('\n# Discovery pools (unseen only). TMDB ids are valid for the `write` step.')
    since = (today - timedelta(days=150)).isoformat()
    pool('Recent releases to rent or buy now (US)', seen, 3, '/discover/movie',
         sort_by='popularity.desc', watch_region=REGION, with_watch_monetization_types='rent|buy',
         **{'primary_release_date.gte': since, 'vote_count.gte': 80})
    pool('Recent releases now streaming (flatrate, US)', seen, 3, '/discover/movie',
         sort_by='popularity.desc', watch_region=REGION, with_watch_monetization_types='flatrate',
         **{'primary_release_date.gte': since, 'vote_count.gte': 80})
    pool('Trending this week', seen, 1, '/trending/movie/week')
    pool('Well-reviewed on streaming (flatrate, US, 1995+)', seen, 5, '/discover/movie',
         sort_by='vote_average.desc', watch_region=REGION, with_watch_monetization_types='flatrate',
         **{'vote_count.gte': 1500, 'primary_release_date.gte': '1995-01-01', 'vote_average.gte': 7.2})
    if today.month == 10:
        pool('OCTOBER horror (genre 27, well-regarded)', seen, 4, '/discover/movie', limit=45,
             sort_by='vote_count.desc', with_genres=27,
             **{'vote_count.gte': 1500, 'vote_average.gte': 6.4})
        pool('OCTOBER horror streaming now (flatrate, US)', seen, 3, '/discover/movie', limit=30,
             sort_by='popularity.desc', with_genres=27, watch_region=REGION,
             with_watch_monetization_types='flatrate', **{'vote_count.gte': 300})

    print('\n# Selection brief (today\'s prompt; stored with the picks and shown on the dashboard)')
    print(build_brief(today, diary, meta, seen.n_blocked, seen.n_recent))
    print(f'''
# Enforced by `write` (violations are rejected)
- Exactly {N_PICKS} picks, no diary films, no duplicates, released and watchable now (stream/rent/buy); <= {MAX_QUEUE} from Watchlist+Pending; era caps above;
  {f"at least {MIN_HORROR_OCT} Horror-genre picks" if today.month == 10 else "no seasonal check"}.
- Prefer tmdb_ids from the lists above; other films are resolved by title+year.
- Also send "angle": 1-2 sentences, your own read of his mood today and how you used it (shown beside the brief).
- Stdin: {{"angle": "...", "picks": [{{"title","year","tmdb_id","why"}}]}}
''')


# ── public scores (scraped by scores.py) ────────────────────────────────────
def add_scores(picks):
    import scores

    def one(o):
        s = scores.lookup(o['tmdb_id'], tmdb=tmdb)
        o['lb_rating'], o['rt_score'], o['rt_audience'], o['rt_url'] = s['lb'], s['rt'], s['aud'], s['rt_url']
        o['imdb_rating'], o['imdb_url'] = s['imdb'], s['imdb_url']
    with ThreadPoolExecutor(5) as ex:
        list(ex.map(one, picks))


def cmd_scores():
    """Backfill scores into the current movie-recs.json (write does this itself)."""
    data = json.load(open(OUT, encoding='utf-8'))
    add_scores(data['picks'])
    json.dump(data, open(OUT, 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
    log_recs(data)
    record_films(data['picks'], 'recommended', data['generated'])
    for o in data['picks']:
        print(f"{o['title']}: LB {o['lb_rating']}  RT {o['rt_score']}")


# ── dated log notes ─────────────────────────────────────────────────────────
def _cell(s):
    return ' '.join(str(s).split()).replace('|', '\\|')


def log_table(cards):
    """Markdown table of dashboard cards; a Release column appears when the cards carry dates."""
    dated = any(c.get('release_date') for c in cards)
    head = ['', 'Film'] + (['Release'] if dated else []) + ['Why', 'Where', 'LB', 'RT']
    lines = ['| ' + ' | '.join(head) + ' |', '|' + ' --- |' * len(head)]
    for c in cards:
        a = c.get('availability') or {}
        where = a.get('kind', '') + (': ' + ', '.join(a['on']) if a.get('on') else '')
        rt = '' if c.get('rt_score') is None else f"{c['rt_score']}%"
        if rt and c.get('rt_url'):
            rt = f"[{rt}]({c['rt_url']})"
        url = c.get('letterboxd_url') or f"https://letterboxd.com/tmdb/{c['tmdb_id']}/"
        row = [f"![poster\\|60]({c['poster']})" if c.get('poster') else '',
               f"[{_cell(c['title'])}]({url}) ({c.get('year') or '?'})"]
        row += [c.get('release_date') or ''] if dated else []
        row += [_cell(c.get('why', '')), _cell(where),
                '' if c.get('lb_rating') is None else f"★ {c['lb_rating']:.1f}", rt]
        lines.append('| ' + ' | '.join(row) + ' |')
    return '\n'.join(lines)


def log_note(root, day, kind, heading, body, extra=None):
    """Keep a dated copy at <root>/YYYY/MM/DD.md (the Diary's layout): the Data/*.json files only
    hold the latest list. Rewrites the day's note; best effort, never fails the caller."""
    path = os.path.join(root, f'{day:%Y}', f'{day:%m}', f'{day:%d}.md')
    fm = {'Type': kind, 'Date': day.isoformat(), 'Alias': f'{kind} {day.isoformat()}', **(extra or {})}
    text = '---\n' + ''.join(f'{k}: {v}\n' for k, v in fm.items()) + f'---\n# {heading}\n\n{body.strip()}\n'
    try:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path + '.tmp', 'w', encoding='utf-8') as f:
            f.write(text)
        os.replace(path + '.tmp', path)
    except OSError as e:
        print(f'warning: could not write {os.path.relpath(path, VAULT)}: {e}')
        return None
    return path


SNAP_DIR = os.path.join(VAULT, '99_Internal/Data/history')   # dated copies of the two dashboard rows; the arrows page through them


def snapshot(kind, key, data):
    """Keep a copy of this list as <kind>/<key>.json so the dashboard can step back to it. Best effort."""
    try:
        d = os.path.join(SNAP_DIR, kind)
        os.makedirs(d, exist_ok=True)
        path = os.path.join(d, f'{key}.json')
        with open(path + '.tmp', 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=1, ensure_ascii=False)
        os.replace(path + '.tmp', path)
    except OSError as e:
        print(f'warning: snapshot not written: {e}')


def log_recs(data):
    snapshot('recs', data['generated'], data)
    day = date.fromisoformat(data['generated'])
    angle = f"> {_cell(data['angle'])}\n\n" if data.get('angle') else ''
    return log_note(RECS_LOG, day, 'Movie Recs', f'Recommended movies, {day:%A %B} {day.day}, {day.year}',
                    angle + log_table(data['picks']))


def record_films(cards, key, day):
    """Every suggested film gets a note, and the note remembers the day. key: 'recommended' or 'upcoming'.

    A film suggested again reuses its note and gains a date. Best effort, like the dated logs:
    a failure warns and never rejects the picks.
    """
    global _STORE
    try:
        import people
        from film_store import lock
        with lock():                            # held to the end; people.run takes none of its own
            _STORE = None                       # read the notes again: the sync may have written them while this waited
            st = store()
            for c in cards:
                m = re.search(r'letterboxd\.com/film/([^/]+)/', c.get('letterboxd_url') or '')
                # The releases job runs on Mondays: a new note's weekly score refresh is spread by id instead.
                film = st.upsert(c['title'], c.get('year'), tmdb_id=c['tmdb_id'], slug=m.group(1) if m else None,
                                 url=c.get('letterboxd_url'), poster=c.get('poster'),
                                 score_day=c['tmdb_id'] % 7 if key == 'upcoming' else None)
                (st.add_recommended if key == 'recommended' else st.add_upcoming)(film, day)
                st.set_scores(film, lb=c.get('lb_rating'), rt=c.get('rt_score'), aud=c.get('rt_audience'), rt_url=c.get('rt_url'),
                              imdb=c.get('imdb_rating'), imdb_url=c.get('imdb_url'))
                film.save()
            from film_store import SHOWS_REL, Store
            people.run(st, tmdb, people.People(os.path.join(VAULT, people.PEOPLE_REL), os.path.join(VAULT, people.INDEX_REL)),
                       log=lambda msg, level='INFO': print(f'people: {msg}'), also=[Store(os.path.join(VAULT, SHOWS_REL))])
    except Exception as e:
        print(f'warning: film notes not updated: {e}')


# ── write ───────────────────────────────────────────────────────────────────
def resolve(pick):
    """-> TMDB movie detail dict, or None. Trusts an id only if the title still matches."""
    title, year = pick['title'], pick.get('year')
    tid = pick.get('tmdb_id')
    if tid:
        d = tmdb(f'/movie/{tid}')
        if d and (norm(d.get('title')) == norm(title) or norm(d.get('original_title')) == norm(title)):
            return d
    best = None
    for params in ({'query': title, 'primary_release_year': year} if year else {'query': title},
                   {'query': title}):
        for c in (tmdb('/search/movie', include_adult='false', **params) or {}).get('results', []):
            cy = year_of(c.get('release_date'))
            if norm(c.get('title')) != norm(title) and norm(c.get('original_title')) != norm(title):
                continue
            if year and (cy is None or abs(cy - year) > 1):
                continue
            if best is None or c.get('vote_count', 0) > best.get('vote_count', 0):
                best = c
    return tmdb(f"/movie/{best['id']}") if best else None


def cmd_write():
    src = sys.argv[2] if len(sys.argv) > 2 else None    # picks file; stdin when omitted
    try:
        if src:
            with open(src, encoding='utf-8') as f:
                payload = json.load(f)
        else:
            payload = json.load(sys.stdin)
        picks = payload['picks']
    except (OSError, ValueError, KeyError, TypeError):
        sys.exit('picks (file argument or stdin) must be JSON: {"angle": "...", "picks": [{"title","year","tmdb_id"?,"why"}]}')
    diary = load_diary()
    seen = Seen(diary)
    queues = {}
    for r in load_queue('want') + load_queue('watchlist'):     # want wins on overlap
        if r['tmdb_id']:
            queues.setdefault(r['tmdb_id'], r)
        queues.setdefault((norm(r['title']), r['year']), r)

    problems, out, ids = [], [], set()
    for p in picks:
        label = f"{p.get('title')} ({p.get('year')})"
        d = resolve(p)
        if not d:
            problems.append(f'{label}: no confident TMDB match; give a tmdb_id from the context lists')
            continue
        title, year = d['title'], year_of(d.get('release_date'))
        if d['id'] in ids:
            problems.append(f'{label}: duplicate pick')
            continue
        ids.add(d['id'])
        if seen.has(d['id'], title, year):
            problems.append(f'{label}: blocked by him with the x button; never recommend it' if seen.is_blocked(d['id'], title, year)
                            else f'{label}: recommended in the last {COOLDOWN_DAYS} days; pick something different' if seen.is_recent(d['id'], title, year)
                            and not any(d['id'] == x['tmdb_id'] for x in diary) else f'{label}: already in the diary')
            continue
        if not d.get('poster_path'):
            problems.append(f'{label}: TMDB has no poster; pick another')
            continue
        why = ' '.join(str(p.get('why', '')).split())
        if not why:
            problems.append(f'{label}: missing "why"')
            continue
        q = queues.get(d['id']) or queues.get((norm(title), year)) or queues.get((norm(p['title']), p.get('year')))
        if not d.get('release_date') or d['release_date'] > date.today().isoformat():
            problems.append(f'{label}: not released yet')
            continue
        if not can_watch(d['id']):
            problems.append(f'{label}: not available to stream, rent or buy in the US (theaters-only or not out)')
            continue
        genres = [g['name'] for g in d.get('genres', [])]
        out.append({'title': title, 'year': year, 'tmdb_id': d['id'], 'poster': IMG + d['poster_path'],
                    'why': why[:160], 'genres': genres, 'availability': avail_card(d['id']),
                    'source': q['source'] if q else 'discovery',
                    'letterboxd_url': (q['url'] if q and q['url'] else f"https://letterboxd.com/tmdb/{d['id']}/")})

    if len(picks) != N_PICKS:
        problems.append(f'need exactly {N_PICKS} picks, got {len(picks)}')
    queued = sum(1 for o in out if o['source'] != 'discovery')
    if queued > MAX_QUEUE:
        problems.append(f'{queued} picks come from watchlist/Pending; max {MAX_QUEUE}')
    if sum(1 for o in out if o['year'] and o['year'] < 1990) > MAX_PRE_1990:
        problems.append(f'more than {MAX_PRE_1990} picks from before 1990')
    if sum(1 for o in out if o['year'] and o['year'] < 1970) > MAX_PRE_1970:
        problems.append(f'more than {MAX_PRE_1970} picks from before 1970')
    if date.today().month == 10:
        horror = sum(1 for o in out if 'Horror' in o['genres'])
        if horror < MIN_HORROR_OCT:
            problems.append(f'October needs at least {MIN_HORROR_OCT} horror picks, got {horror}')
    if problems:
        print('REJECTED, nothing written:\n- ' + '\n- '.join(problems))
        sys.exit(1)

    for o in out:
        del o['genres']
    add_scores(out)         # best effort: a missing score is null, never a rejection
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    tmp = OUT + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump({'generated': date.today().isoformat(),
                   'prompt': build_brief(date.today(), diary, fill_meta([d['tmdb_id'] for d in diary if d['tmdb_id']]), seen.n_blocked, seen.n_recent),
                   'angle': ' '.join(str(payload.get('angle', '')).split())[:400],
                   'picks': out}, f, indent=1, ensure_ascii=False)
    os.replace(tmp, OUT)
    save_history(date.today(), out)
    log_recs({'generated': date.today().isoformat(), 'angle': ' '.join(str(payload.get('angle', '')).split())[:400], 'picks': out})
    record_films(out, 'recommended', date.today().isoformat())
    if src:     # the draft is spent; a rejected one is kept so the picker can fix it
        try:
            os.remove(src)
        except OSError:
            pass
    print(f'wrote {len(out)} picks ({queued} from queues) to {os.path.relpath(OUT, VAULT)}')


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else ''
    {'context': cmd_context, 'write': cmd_write, 'scores': cmd_scores}.get(cmd, lambda: sys.exit(__doc__))()
