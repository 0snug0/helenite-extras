#!/usr/bin/env python3
"""Weekly "New Releases" and "Coming Soon" rows for the dashboard.

Writes 99_Internal/Data/movie-releases.json: 5 films released in the US in the last
RELEASED_DAYS days and 5 announced for the next UPCOMING_DAYS, most popular first. No LLM:
it is TMDB /discover plus the same filters movie_recs.py uses (never anything in the diary or
blocked with the dashboard's x button, which both rows share with the daily recommendations).

  movie_releases.py            refresh unless this ISO week's file already exists
  movie_releases.py --force    refresh now (also tops up after x-ing films out of a row)

Run weekly by ~/Library/LaunchAgents/{{LABEL_PREFIX}}movie-releases.plist.
"""
from __future__ import annotations

import json
import os
import sys
from datetime import date, timedelta

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import movie_recs as mr  # noqa: E402  (shared TMDB client, diary/blocked readers, score scrapers)

OUT = os.path.join(mr.VAULT, '99_Internal/Data/movie-releases.json')
LOG = os.path.join(mr.VAULT, '50_Personal/Letterboxd/Upcoming')   # one note per week, YYYY/MM/DD.md of its Monday
N = 5
RELEASED_DAYS = 28
UPCOMING_DAYS = 120
MIN_VOTES = 25                       # released: filters out obscure titles with no signal
THEATRICAL_OR_DIGITAL = '2|3|4|6'    # not festival premieres (1) or physical (5)


def watchlist_keys():
    """(tmdb ids, (norm title, year) keys) of films to leave out: watchlisted, or listed in an earlier week."""
    ids, keys = set(), set()
    today = date.today()
    monday = (today - timedelta(days=today.weekday())).isoformat()
    for film in mr.store().films:
        f = film.fm
        # On the watchlist, or listed here in an earlier week (this week's own entries don't count, so --force can re-roll).
        earlier = any(str(d) != monday for d in f.get('upcoming') or [])
        if not (f.get('on_watchlist') or earlier):
            continue
        if f.get('tmdb_id') and film.kind == 'movie':
            ids.add(int(f['tmdb_id']))
        keys.add((mr.norm(str(f.get('title') or '')), f.get('year')))
    return ids, keys


def discover(seen, lo, hi, vote_floor, sort='popularity.desc', pages=4):
    rows, ids = [], set()
    wl_ids, wl_keys = watchlist_keys()
    for pg in range(1, pages + 1):
        res = mr.tmdb('/discover/movie', page=pg, region=mr.REGION, sort_by=sort,
                      include_adult='false', language='en-US',
                      with_release_type=THEATRICAL_OR_DIGITAL,
                      **{'release_date.gte': lo, 'release_date.lte': hi, 'vote_count.gte': vote_floor})
        for r in (res or {}).get('results', []):
            y = mr.year_of(r.get('release_date'))
            # The regional filter can pass films whose global date is outside the window; the card shows that date.
            if (r['id'] in ids or not y or not r.get('poster_path') or not lo <= r['release_date'] <= hi
                    or seen.has(r['id'], r.get('title', ''), y)
                    or r['id'] in wl_ids or (mr.norm(r.get('title', '')), y) in wl_keys):
                continue
            ids.add(r['id'])
            rows.append(r)
    return rows


def card(r, upcoming):
    g = [mr.GENRES.get(i) for i in r.get('genre_ids', []) if mr.GENRES.get(i)]
    o = {'title': r['title'], 'year': mr.year_of(r['release_date']), 'tmdb_id': r['id'],
         'poster': mr.IMG + r['poster_path'], 'release_date': r['release_date'],
         'why': ' '.join((r.get('overview') or '').split()),
         'genres': g[:3], 'letterboxd_url': f"https://letterboxd.com/tmdb/{r['id']}/"}
    if not upcoming:
        a = mr.availability(r['id'])
        o['availability'] = mr.avail_card(r['id']) if any(a.values()) else {'kind': 'In theaters', 'on': []}
    return o


def build():
    seen = mr.Seen(mr.load_diary())
    today = date.today()
    # Released rows must be out (release_date <= today); coming-soon starts tomorrow.
    released = discover(seen, (today - timedelta(days=RELEASED_DAYS)).isoformat(), today.isoformat(), MIN_VOTES)
    upcoming = discover(seen, (today + timedelta(days=1)).isoformat(),
                        (today + timedelta(days=UPCOMING_DAYS)).isoformat(), 0)
    # Coming soon: nearest, popular titles. Popularity picks the 5, then show them in date order.
    taken = {r['id'] for r in released[:N]}
    upcoming = [r for r in upcoming if r['id'] not in taken]
    out_up = sorted((card(r, True) for r in upcoming[:N]), key=lambda c: c['release_date'])
    out_rel = [card(r, False) for r in released[:N]]
    mr.add_scores(out_rel)
    return {'generated': today.isoformat(), 'week': '%d-W%02d' % today.isocalendar()[:2],
            'released': out_rel, 'upcoming': out_up}


def log_week(data):
    """Dated copy of the week's row. Named for the week's Monday, so a --force re-roll rewrites it."""
    day = date.fromisoformat(data['generated'])
    day -= timedelta(days=day.weekday())
    mr.snapshot('releases', day.isoformat(), data)
    body = ''.join(f'## {title}\n\n{mr.log_table(data[k])}\n\n'
                   for k, title in (('released', 'New releases'), ('upcoming', 'Coming soon')) if data.get(k))
    return mr.log_note(LOG, day, 'Movie Releases', f'New & upcoming, week of {day:%B} {day.day}, {day.year}',
                       body, {'Week': data['week']})


def main():
    force = '--force' in sys.argv
    week = '%d-W%02d' % date.today().isocalendar()[:2]
    if not force:
        try:
            if json.load(open(OUT, encoding='utf-8')).get('week') == week:
                print(f'{week} already generated; use --force to refresh')
                return
        except (OSError, ValueError):
            pass
    data = build()
    if len(data['released']) < N or len(data['upcoming']) < N:
        print(f"warning: only {len(data['released'])} released / {len(data['upcoming'])} upcoming found")
    if not data['released'] and not data['upcoming']:
        sys.exit('nothing found; leaving the previous file in place')
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    tmp = OUT + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=1, ensure_ascii=False)
    os.replace(tmp, OUT)
    log_week(data)
    day = date.fromisoformat(data['generated'])
    mr.record_films(data['released'] + data['upcoming'], 'upcoming', (day - timedelta(days=day.weekday())).isoformat())
    print(f"wrote {len(data['released'])} released + {len(data['upcoming'])} upcoming to {os.path.relpath(OUT, mr.VAULT)}")
    for k in ('released', 'upcoming'):
        for c in data[k]:
            print(f"  {k[:3]} {c['release_date']} {c['title']} ({c['year']})")


if __name__ == '__main__':
    main()
