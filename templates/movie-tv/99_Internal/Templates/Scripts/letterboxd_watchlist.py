#!/usr/bin/env python3
"""Mirror a Letterboxd watchlist onto the film notes' `on_watchlist` flag.

Letterboxd has no watchlist RSS (/watchlist/rss/ is 403), so this scrapes the
public watchlist pages. Films are matched by `letterboxd_slug` (and, when Letterboxd
has renamed a slug, by the TMDB id on the film page): a film that
appears gets `on_watchlist: true` (and a film note, if it has none); a film that
disappears (watched, or removed) gets `on_watchlist: false`. Nothing is deleted:
the note also holds the film's watches and history. If the scrape comes back
empty no flag is cleared, so a Letterboxd outage or markup change cannot empty
the watchlist.

The TMDB id comes from the film page's data-tmdb-id (exact, and covers TV), so
no title search is needed; the poster comes from TMDB when a token is set.

Called from letterboxd_daily.py. Run directly with --seed-csv <watchlist.csv>
to take `watchlist_added` from a Letterboxd export instead of today's date.
"""
from __future__ import annotations

import csv
import html
import os
import re
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

ITEM_RE = re.compile(r'data-item-name="([^"]*)"\s+data-item-slug="([^"]*)"')
NAME_RE = re.compile(r'^(.*?)(?: \((\d{4})\))?$')
TMDB_RE = re.compile(r'data-tmdb-type="(\w+)"\s+data-tmdb-id="(\d+)"')


def scrape(username, fetch, pause=1):
    """[(slug, title, year)] in watchlist order."""
    out, seen = [], set()
    for page in range(1, 200):
        suffix = '' if page == 1 else f'page/{page}/'
        body = fetch(f'https://letterboxd.com/{username}/watchlist/{suffix}').decode('utf-8')
        items = ITEM_RE.findall(body)
        if not items:
            break
        for name, slug in items:
            if slug in seen:
                continue
            seen.add(slug)
            title, year = NAME_RE.match(html.unescape(name)).groups()
            out.append((slug, title, int(year) if year else None))
        time.sleep(pause)
    return out


def tmdb_of(slug, fetch):
    body = fetch(f'https://letterboxd.com/film/{slug}/').decode('utf-8')
    m = TMDB_RE.search(body)
    return (m.group(1), m.group(2)) if m else ('', '')


def poster(kind, tmdb_id, token):
    if not (token and kind in ('movie', 'tv') and tmdb_id):
        return ''
    from tmdb_match import get, poster_url
    rec = get(f'/{kind}/{tmdb_id}', {}, token) or {}
    return poster_url(rec.get('poster_path'))


def sync_watchlist(username, store, token, log, added_dates=None, fetch=None, pause=1, skip=()):
    """store: film_store.Store. added_dates: {(title, year): 'YYYY-MM-DD'} from a CSV export.
    skip: Letterboxd slugs of TV shows that live in the Serializd show notes. TV is never given a film note here:
    a slug in `skip`, or one whose page says it is a TV series, is left out (Letterboxd is for movies)."""
    if fetch is None:
        from letterboxd_daily import fetch
    films = scrape(username, fetch, pause)
    flagged = sum(1 for f in store.films if f.fm.get('on_watchlist'))
    log(f'watchlist: {len(films)} films on Letterboxd, {flagged} flagged on disk')

    added, listed = 0, []
    for slug, title, year in films:
        film = store.by_slug.get(slug)
        if film is None and slug in skip:
            continue
        if film is None:                                # first sighting of this slug: one page fetch for its TMDB id
            kind, tmdb_id = tmdb_of(slug, fetch)
            if kind == 'tv':
                log(f'watchlist: {title} is a TV series; skipped (TV goes on Serializd)')
                time.sleep(pause)
                continue
            film = store.upsert(title, year, tmdb_id=int(tmdb_id) if tmdb_id else None, tmdb_type=kind or 'movie',
                                slug=slug, url=f'https://letterboxd.com/film/{slug}/',
                                poster=poster(kind, tmdb_id, token) or None)
            time.sleep(pause)
            # Letterboxd renamed the slug: the note follows it. Only when the page's TMDB id confirms it is the same
            # film; a title + year match (no id on the page) could be a different film whose slug is right.
            if (film.fm.get('letterboxd_slug') != slug and tmdb_id
                    and film.fm.get('tmdb_id') and int(film.fm['tmdb_id']) == int(tmdb_id) and film.kind == (kind or 'movie')):
                store.set_slug(film, slug)
        listed.append(film)
        if not film.fm.get('on_watchlist'):
            store.set_watchlist(film, True, (added_dates or {}).get((title, year)))
            added += 1
            log(f'watchlist: added {os.path.basename(film.path)}')
        film.save()

    removed = 0
    if films:
        for film in store.films:
            if film.fm.get('on_watchlist') and not any(film is f for f in listed):
                store.set_watchlist(film, False)
                film.save()
                removed += 1
                log(f'watchlist: removed {os.path.basename(film.path)} (note kept)')
    else:
        log('watchlist: scrape returned nothing - skipping removals', 'WARN')

    log(f'watchlist: {added} added, {removed} removed')


if __name__ == '__main__':
    import argparse
    import json
    from film_store import FILMS_REL, Store, lock
    from letterboxd_daily import CONFIG, VAULT, log, tmdb_token

    ap = argparse.ArgumentParser()
    ap.add_argument('--seed-csv', help='Letterboxd export watchlist.csv, for watchlist_added')
    args = ap.parse_args()
    dates = {}
    if args.seed_csv:
        for row in csv.DictReader(open(args.seed_csv, encoding='utf-8')):
            dates[(row['Name'], int(row['Year']) if row['Year'] else None)] = row['Date']
    cfg = json.load(open(CONFIG))
    with lock():                                        # sync_watchlist() itself takes no lock: the 09:00 sync calls it holding this one
        from film_store import SHOWS_REL
        sync_watchlist(cfg['username'], Store(os.path.join(VAULT, FILMS_REL)), tmdb_token(), log, dates,
                       skip=set(Store(os.path.join(VAULT, SHOWS_REL)).by_slug))
