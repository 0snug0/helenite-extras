#!/usr/bin/env python3
"""The TV half of the home page: writes 99_Internal/Data/tv-home.json for the `tv-home` view.

  upnext    every show on the Serializd currently-watching list: the next episode after the last one logged,
            when it airs (out now / today / tomorrow / a date / not announced), how many aired episodes are
            waiting, where it streams, and whether Sonarr already has the file (ready in Plex).
  week      the next 7 days: every episode airing for a show that is being watched, on the watchlist or was watched.
  recs      10 shows from TMDB's per-show recommendations, seeded by the shows in the vault and weighted by
            their ratings ("Because you liked …"). Shows already in the vault, or blocked with the view's x, are left out.
  returning followed shows whose next season premieres within RETURN_DAYS.
  released / upcoming   popular new and coming premieres (TMDB /discover/tv), never a followed show.

No LLM. Show notes come from serializd_sync.py (50_Personal/Serializd/Shows); this only reads them.
`upnext` and `week` are rebuilt every run; recs and the premiere rows once a day.
Run by serializd_sync.py after each sync; `tv_home.py --force` rebuilds everything now.
"""
from __future__ import annotations

import json
import os
import re
import sys
import urllib.request
from datetime import date, timedelta

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from film_store import SHOWS_REL, Store  # noqa: E402

OUT_REL = '99_Internal/Data/tv-home.json'
BLOCKED_REL = '99_Internal/Data/tv-recs-blocked.json'      # written by the view's x button
IMG, STILL, BACKDROP = 'https://image.tmdb.org/t/p/w500', 'https://image.tmdb.org/t/p/w300', 'https://image.tmdb.org/t/p/w780'
SHOW_URL = 'https://www.serializd.com/show/{}'
REGION = 'US'
N_RECS, N_NEW = 10, 6
RETURN_DAYS, RELEASED_DAYS, UPCOMING_DAYS = 90, 28, 90
GUID_RE = re.compile(r'^sz:\d+:S(\d+)(?:E(\d+))?$')
# The services paid for (same list as the downloaders' streaming rule): a show streaming there needs no download.
MINE_RE = re.compile(r'^(netflix|amazonprimevideo|appletv|appletvplus|max|hbomax|hbo)(withads|standardwithads|basicwithads)?$')
INF = 10 ** 6


def code(s, e=None):
    return f'S{int(s):02d}E{int(e):02d}' if e is not None else f'S{int(s):02d}'


def last_logged(fm):
    """The furthest (season, episode) in a show note's Serializd watches; a whole-season log counts as its end."""
    best = None
    for g in fm.get('letterboxd_guids') or []:
        m = GUID_RE.match(str(g or ''))
        if m:
            pos = (int(m.group(1)), int(m.group(2)) if m.group(2) else INF)
            best = max(best, pos) if best else pos
    return best


def up_next(episodes, pos, today):
    """episodes: TMDB season episodes (any seasons), pos: last_logged or None.
    -> (next episode dict or None, aired episodes after pos, total aired)."""
    eps = sorted((e for e in episodes if e.get('season_number', 0) > 0), key=lambda e: (e['season_number'], e['episode_number']))
    after = [e for e in eps if not pos or (e['season_number'], e['episode_number']) > pos]
    aired = [e for e in after if e.get('air_date') and e['air_date'] <= today]
    return (after[0] if after else None), len(aired), len([e for e in eps if e.get('air_date') and e['air_date'] <= today])


def aired_total(d):
    """Episodes aired so far, from /tv/{id}: whole seasons before the last aired episode's, plus that episode's number."""
    last = d.get('last_episode_to_air') or {}
    if not last.get('season_number'):
        return 0
    return sum(x.get('episode_count') or 0 for x in d.get('seasons') or []
               if 0 < (x.get('season_number') or 0) < last['season_number']) + (last.get('episode_number') or 0)


def when(air_date, today):
    """-> (status, label) for an episode's air date."""
    if not air_date:
        return 'tba', 'Date not announced'
    d, t = date.fromisoformat(air_date), date.fromisoformat(today)
    n = (d - t).days
    if n < 0:
        return 'out', 'Out now'
    if n == 0:
        return 'today', 'Airs today'
    if n == 1:
        return 'soon', 'Tomorrow'
    if n < 7:
        return 'soon', d.strftime('%A')
    return 'later', f"{d.strftime('%b')} {d.day}" + (f', {d.year}' if d.year != t.year else '') + f' · in {n} days'


def providers(tmdb, kind, tid):
    """-> (streaming services, any of them paid for). Flatrate only: rent/buy is not "where it streams"."""
    d = ((tmdb(f'/{kind}/{tid}/watch/providers') or {}).get('results') or {}).get(REGION) or {}
    names = [p['provider_name'] for p in d.get('flatrate') or []]
    return names[:3], any(MINE_RE.match(re.sub('[^a-z0-9]', '', n.lower())) for n in names)


def score_recs(seeds, recs_for, exclude, n=N_RECS):
    """seeds: [(tmdb_id, title, weight)]; recs_for(id) -> TMDB results in rank order.
    -> [(result, score, [seed titles in order of contribution])], best first."""
    acc = {}
    for sid, title, w in seeds:
        for i, r in enumerate((recs_for(sid) or [])[:20]):
            if r['id'] in exclude or not r.get('poster_path'):
                continue
            c = w * (1 - i / 25)
            entry = acc.setdefault(r['id'], [r, 0.0, {}])
            entry[1] += c
            entry[2][title] = entry[2].get(title, 0) + c
    ranked = sorted(acc.values(), key=lambda x: (-x[1], -(x[0].get('popularity') or 0)))[:n]
    return [(r, s, [t for t, _ in sorted(by.items(), key=lambda kv: -kv[1])]) for r, s, by in ranked]


def because(titles):
    t = titles[:3]
    return 'Because you liked ' + (t[0] if len(t) == 1 else ', '.join(t[:-1]) + ' and ' + t[-1])


def year(d):
    return int(d[:4]) if (d or '')[:4].isdigit() else None


def sonarr_files(vault):
    """tmdb id -> {(season, episode)} on disk, from Sonarr (key from the vault .env). Empty when Sonarr can't be reached."""
    key = url = None
    try:
        for line in open(os.path.join(vault, '.env'), encoding='utf-8', errors='ignore'):
            k, _, v = line.strip().partition('=')
            if k.strip() == 'SONARR_API_KEY':
                key = v.strip().strip('"\'')
            if k.strip() == 'SONARR_URL':
                url = v.strip().strip('"\'')
    except OSError:
        return {}
    if not key:
        return {}
    url = url or 'http://localhost:8989'
    get = lambda path: json.load(urllib.request.urlopen(urllib.request.Request(f'{url}/api/v3{path}', headers={'X-Api-Key': key}), timeout=20))
    out = {}
    try:
        for s in get('/series'):
            if (s.get('statistics') or {}).get('episodeFileCount') and s.get('tmdbId'):
                out[s['tmdbId']] = {(e['seasonNumber'], e['episodeNumber']) for e in get(f"/episode?seriesId={s['id']}") if e.get('hasFile')}
    except Exception:
        return {}
    return out


def build(notes, tmdb, today, files=None, blocked=(), previous=None, force=False, log=print, vault=None):
    """notes: Film objects from the Shows store; vault: root that note paths are given relative to. -> the tv-home.json dict."""
    files = files or {}
    shows = {int(n.fm['tmdb_id']): n for n in notes if n.fm.get('tmdb_id')}
    detail = {}
    def show(tid):
        if tid not in detail:
            detail[tid] = tmdb(f'/tv/{tid}') or {}
        return detail[tid]
    seasons = {}
    def season(tid, s):
        if (tid, s) not in seasons:
            seasons[(tid, s)] = (tmdb(f'/tv/{tid}/season/{s}') or {}).get('episodes') or []
        return seasons[(tid, s)]

    upnext = []
    for tid, n in shows.items():
        f = n.fm
        if not f.get('watching'):
            continue
        d, pos = show(tid), last_logged(f)
        start = pos[0] if pos else 1
        eps = season(tid, start) + (season(tid, start + 1) if (d.get('number_of_seasons') or 0) > start else [])
        nxt, behind, _ = up_next(eps, pos, today)
        if not pos:                                   # not started: every aired episode is waiting, not just the seasons fetched
            behind = aired_total(d) or behind
        streams, mine = providers(tmdb, 'tv', tid)
        card = {'tmdb_id': tid, 'title': f.get('title'), 'poster': f.get('poster'), 'path': os.path.relpath(n.path, vault) if vault else n.path,
                'backdrop': BACKDROP + d['backdrop_path'] if d.get('backdrop_path') else None,
                'serializd_url': f.get('serializd_url') or SHOW_URL.format(tid), 'streams': streams, 'mine': mine,
                'last': code(*pos) if pos and pos[1] != INF else (code(pos[0]) if pos else None), 'last_date': f.get('last_watched'),
                'behind': behind, 'show_status': d.get('status')}
        if nxt:
            status, label = when(nxt.get('air_date'), today)
            s_eps = [e for e in eps if e['season_number'] == nxt['season_number']]
            card.update({'status': status, 'label': label, 'next': {
                'code': code(nxt['season_number'], nxt['episode_number']), 'name': nxt.get('name') or '',
                'air_date': nxt.get('air_date'), 'type': nxt.get('episode_type') or 'standard', 'runtime': nxt.get('runtime'),
                'still': STILL + nxt['still_path'] if nxt.get('still_path') else None, 'overview': nxt.get('overview') or '',
                'season_total': len(s_eps),
                'season_done': len([e for e in s_eps if pos and (e['season_number'], e['episode_number']) <= pos]),
                'in_plex': (nxt['season_number'], nxt['episode_number']) in files.get(tid, set())}})
        else:
            ended = d.get('status') in ('Ended', 'Canceled')
            card.update({'status': 'ended' if ended else 'caught-up', 'label': 'Finished' if ended else 'All caught up', 'next': None})
        upnext.append(card)
    rank = {'out': 0, 'today': 1, 'soon': 2, 'later': 3, 'tba': 4, 'caught-up': 5, 'ended': 6}
    upnext.sort(key=lambda c: (rank[c['status']], (c.get('next') or {}).get('air_date') or '9999', -(c['behind'] or 0), c['title'] or ''))

    # The week ahead, for every followed show (watching, watchlist, or watched).
    week, end = [], (date.fromisoformat(today) + timedelta(days=6)).isoformat()
    for tid, n in shows.items():
        f = n.fm
        if not (f.get('watching') or f.get('on_watchlist') or f.get('watches')):
            continue
        # TMDB moves an episode from next_episode_to_air to last_episode_to_air on its air date: look at both seasons.
        d = show(tid)
        nums = {x['season_number'] for x in (d.get('next_episode_to_air') or {}, d.get('last_episode_to_air') or {})
                if x.get('air_date') and today <= x['air_date'] <= end}
        for e in (e for s in sorted(nums) for e in season(tid, s)):
            if e.get('air_date') and today <= e['air_date'] <= end:
                week.append({'date': e['air_date'], 'tmdb_id': tid, 'title': f.get('title'), 'poster': f.get('poster'),
                             'code': code(e['season_number'], e['episode_number']), 'name': e.get('name') or '',
                             'type': e.get('episode_type') or 'standard', 'watching': bool(f.get('watching')),
                             'serializd_url': f.get('serializd_url') or SHOW_URL.format(tid)})
    week.sort(key=lambda x: (x['date'], not x['watching'], x['title'] or '', x['code']))

    out = {'generated': today, 'upnext': upnext, 'week': week}
    prev = previous or {}
    if not force and prev.get('daily') == today and 'recs' in prev:
        for k in ('recs', 'returning', 'released', 'upcoming', 'daily'):
            out[k] = prev.get(k)
        return out

    # Recommendations, seeded by the shows in the vault.
    seeds = []
    for tid, n in shows.items():
        f = n.fm
        rated = [r for r in f.get('ratings') or [] if r]
        if f.get('watches') or f.get('watching'):
            w = (sum(rated) / len(rated) / 10 if rated else 0.7) + (0.2 if f.get('watching') else 0)
            if rated and sum(rated) / len(rated) < 5:          # under 2.5 stars: not something to find more of
                continue
        elif f.get('on_watchlist'):
            w = 0.4
        else:
            continue
        seeds.append((tid, f.get('title'), w))
    blocked_ids = {int(b['tmdb_id']) for b in blocked if b.get('tmdb_id')}
    exclude = set(shows) | blocked_ids
    recs = []
    for r, s, by in score_recs(seeds, lambda tid: (tmdb(f'/tv/{tid}/recommendations') or {}).get('results'), exclude):
        streams, mine = providers(tmdb, 'tv', r['id'])
        recs.append({'tmdb_id': r['id'], 'title': r.get('name'), 'year': year(r.get('first_air_date')),
                     'poster': IMG + r['poster_path'], 'why': because(by), 'overview': ' '.join((r.get('overview') or '').split()),
                     'rating': round(r['vote_average'] / 2, 1) if r.get('vote_count', 0) >= 20 and r.get('vote_average') else None,
                     'streams': streams, 'mine': mine, 'serializd_url': SHOW_URL.format(r['id'])})

    # Followed shows coming back: their next episode opens a season soon.
    returning, horizon = [], (date.fromisoformat(today) + timedelta(days=RETURN_DAYS)).isoformat()
    for tid, n in shows.items():
        nx = show(tid).get('next_episode_to_air') or {}
        if nx.get('episode_number') == 1 and nx.get('air_date') and today <= nx['air_date'] <= horizon:
            returning.append({'tmdb_id': tid, 'title': n.fm.get('title'), 'poster': n.fm.get('poster'),
                              'date': nx['air_date'], 'label': f"Season {nx['season_number']} premieres",
                              'serializd_url': n.fm.get('serializd_url') or SHOW_URL.format(tid)})
    returning.sort(key=lambda x: x['date'])

    def discover(lo, hi, votes):
        rows = []
        for pg in (1, 2):
            res = tmdb('/discover/tv', page=pg, sort_by='popularity.desc', with_original_language='en', watch_region=REGION,
                       **{'first_air_date.gte': lo, 'first_air_date.lte': hi, 'vote_count.gte': votes}) or {}
            for r in res.get('results') or []:
                if r['id'] in exclude or not r.get('poster_path') or any(x['id'] == r['id'] for x in rows):
                    continue
                rows.append(r)
            if len(rows) >= N_NEW:
                break
        cards = []
        for r in rows[:N_NEW]:
            streams, mine = providers(tmdb, 'tv', r['id'])
            cards.append({'tmdb_id': r['id'], 'title': r.get('name'), 'year': year(r.get('first_air_date')), 'date': r.get('first_air_date'),
                          'poster': IMG + r['poster_path'], 'overview': ' '.join((r.get('overview') or '').split()),
                          'streams': streams, 'mine': mine, 'serializd_url': SHOW_URL.format(r['id'])})
        return cards
    t = date.fromisoformat(today)
    released = discover((t - timedelta(days=RELEASED_DAYS)).isoformat(), today, 10)
    upcoming = sorted(discover((t + timedelta(days=1)).isoformat(), (t + timedelta(days=UPCOMING_DAYS)).isoformat(), 0), key=lambda c: c['date'] or '')
    out.update({'daily': today, 'recs': recs, 'returning': returning, 'released': released, 'upcoming': upcoming})
    log(f'tv-home: {len(upnext)} up next, {len(week)} this week, {len(recs)} recs, {len(returning)} returning, '
        f'{len(released)} new, {len(upcoming)} upcoming')
    return out


def main(force=False, log=None):
    import movie_recs as mr
    vault = mr.VAULT
    log = log or (lambda m, level='INFO': print(f'[{level}] {m}', flush=True))
    out_path = os.path.join(vault, OUT_REL)
    try:
        previous = json.load(open(out_path, encoding='utf-8'))
    except (OSError, ValueError):
        previous = None
    try:
        blocked = json.load(open(os.path.join(vault, BLOCKED_REL), encoding='utf-8')).get('blocked') or []
    except (OSError, ValueError):
        blocked = []
    notes = Store(os.path.join(vault, SHOWS_REL)).films
    data = build(notes, mr.tmdb, date.today().isoformat(), sonarr_files(vault), blocked, previous, force, log, vault)
    tmp = f'{out_path}.{os.getpid()}.tmp'
    with open(tmp, 'w', encoding='utf-8') as fh:
        json.dump(data, fh, ensure_ascii=False, indent=1)
    os.replace(tmp, out_path)


if __name__ == '__main__':
    main(force='--force' in sys.argv)
