#!/usr/bin/env python3
"""Headless daily Letterboxd -> Obsidian sync with TMDB enrichment.

Runs without Obsidian open. There is one note per film, in Films/ (film_store.py);
a diary entry is a watch recorded on its film's note.

Each run:
  1. Reads the username from letterboxd_config.json next to this script.
  2. Fetches the Letterboxd RSS feed and keeps real diary entries (lists dropped).
  3. Records a watch for every entry whose guid is not already on a film note.
     Because it diffs the whole feed each run, missed days self-reconcile -- up to
     the feed's ~50-entry window. Beyond that it warns; recovery needs a CSV export.
  4. Fills tmdb_id/poster on any watched film still missing them via title+year
     search, remembering titles with no TMDB movie match so they are not re-queried.
  5. Mirrors the watchlist onto the notes' on_watchlist flag (letterboxd_watchlist.py).
  6. Fetches cast and crew for films that have none, and creates person notes (people.py).
  7. Refreshes the public scores of the films due today (scores.py).

--diary-only (the 5-minute poll) does 2-4 and 6, and logs only when something changed.

Between 3 and 4, a newly recorded entry that carries a rating takes its film off
the watchlist and out of Radarr, file kept (letterboxd_rated.py).

Do not re-enable the letterboxd-mirror plugin: it writes one note per diary entry
into its own folder and knows nothing of Films/.

Env: TMDB_TOKEN (TMDB v4 read access token). Without it, steps 4, 6 and 7 are skipped.
Exit: 0 ok, 1 hard failure.
"""
from __future__ import annotations

import html
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
import xml.dom.minidom
from datetime import datetime, timezone

VAULT = os.environ.get('LETTERBOXD_VAULT', os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..')))
CONFIG = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'letterboxd_config.json')
STATE_DIR = os.path.expanduser('~/Library/Application Support/letterboxd-sync')
NO_MATCH_FILE = os.path.join(STATE_DIR, 'tmdb-no-match.json')

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

LOG_PREFIX = 'letterboxd-sync'


QUIET = False      # --diary-only: stay silent unless something changed, so a 5-minute poll doesn't flood the log


def log(msg, level='INFO'):
    if QUIET and level == 'INFO' and not msg.startswith(('created ', 'enriched ', 'rated: ')):
        return
    stamp = datetime.now(timezone.utc).astimezone().isoformat(timespec='seconds')
    print(f'{stamp} [{level}] {LOG_PREFIX}: {msg}', flush=True)


# ---------------------------------------------------------------- RSS parsing

NS_LB = 'letterboxd'
GUID_RE = re.compile(r'^letterboxd-(?:review|watch)-(\d+)$')


def _text(node, name):
    els = node.getElementsByTagName(name)
    if els and els[0].firstChild:
        return els[0].firstChild.data
    return ''


def strip_html(fragment):
    """Port of the plugin's review cleanup (Wt)."""
    s = re.sub(r'<p><img[^>]*/?></p>', '', fragment)
    s = re.sub(r'<p><em>This review may contain spoilers\.</em></p>', '', s)
    s = re.sub(r'<p>Watched on [^<]+</p>', '', s)
    s = re.sub(r'</p>\s*<p>', '\n\n', s)
    s = re.sub(r'</?p>', '', s)
    s = re.sub(r'<br\s*/?>', '\n', s)
    s = html.unescape(s)
    s = re.sub(r'<[^>]+>', '', s)
    return s.strip()


def poster_from_description(fragment):
    m = re.search(r'<img\s+src="([^"]+)"', fragment)
    return m.group(1) if m else ''


def fetch(url, timeout=30, tries=4):
    last = None
    for attempt in range(tries):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 obsidian-letterboxd-sync/1.0'})
            with urllib.request.urlopen(req, timeout=timeout) as r:
                if r.status != 200:
                    raise RuntimeError(f'HTTP {r.status}')
                return r.read()
        except Exception as e:                                  # transient network
            last = e
            if attempt < tries - 1:
                time.sleep(3 * (attempt + 1))
    raise RuntimeError(f'could not fetch {url}: {last}')


def fetch_feed(username):
    return fetch(f'https://letterboxd.com/{username}/rss/')


def parse_entries(xml_bytes):
    doc = xml.dom.minidom.parseString(xml_bytes)
    out = []
    for item in doc.getElementsByTagName('item'):
        raw_guid = _text(item, 'guid')
        m = GUID_RE.match(raw_guid)
        title = _text(item, f'{NS_LB}:filmTitle')
        watched = _text(item, f'{NS_LB}:watchedDate')
        if not m or not title or not watched:
            continue                                            # lists, etc.
        rating = _text(item, f'{NS_LB}:memberRating')
        desc = _text(item, 'description')
        out.append({
            'guid': m.group(1),
            'filmTitle': title,
            'filmYear': int(_text(item, f'{NS_LB}:filmYear') or 0),
            'watchedDate': watched,
            'rewatch': _text(item, f'{NS_LB}:rewatch').strip().lower() == 'yes',
            'userRatingNo': float(rating) if rating else None,
            'link': _text(item, 'link'),
            'tmdbId': _text(item, 'tmdb:movieId'),
            'posterUrl': poster_from_description(desc),
            'review': strip_html(desc),
            'tags': [],
        })
    return out


# ------------------------------------------------------------------ main flow


def load_no_match():
    try:
        return set(tuple(x) for x in json.load(open(NO_MATCH_FILE)))
    except Exception:
        return set()


def save_no_match(s):
    os.makedirs(STATE_DIR, exist_ok=True)
    tmp = NO_MATCH_FILE + '.tmp'
    with open(tmp, 'w') as fh:
        json.dump(sorted(list(x) for x in s), fh, indent=1)
    os.replace(tmp, NO_MATCH_FILE)


def enrich(store, token):
    """Fill tmdb_id/poster on watched films missing either, via TMDB title+year search."""
    from tmdb_match import pick, poster_url
    no_match = load_no_match()
    filled = skipped = failed = 0

    for film in store.films:
        f = film.fm
        if (f.get('tmdb_id') and f.get('poster')) or not f.get('watches') or not f.get('year'):
            continue
        title, year = f['title'], int(f['year'])
        if (title, year) in no_match:
            skipped += 1
            continue
        try:
            tmdb_id, poster_path, how = pick(title, year, token)
        except Exception as e:
            log(f'TMDB lookup failed for {title} ({year}): {e}', 'WARN')
            failed += 1
            continue
        if tmdb_id is None:
            no_match.add((title, year))
            log(f'no TMDB movie match: {title} ({year}) [{how}] - likely TV, '
                f'will not retry', 'WARN')
            continue
        if not f.get('tmdb_id') and not store.set_tmdb(film, tmdb_id):
            log(f'{title} ({year}): tmdb {tmdb_id} already belongs to another film note - left without an id', 'WARN')
            no_match.add((title, year))
            continue
        url = poster_url(poster_path)
        if url:
            store.set_poster(film, url)
        film.save()
        filled += 1
        log(f'enriched {title} ({year}) -> tmdb {tmdb_id} [{how}]')

    save_no_match(no_match)
    return filled, skipped, failed


def confirmed_rated(rated, entries, have):
    """The rated entries to act on: none unless part of the feed was already on disk.

    A first run, or a gap longer than the feed window, makes the whole feed look new,
    and that must not take fifty films off the watchlist and out of Radarr.
    """
    if rated and not any(e['guid'] in have for e in entries):
        log(f'{len(rated)} rated entries not cleaned up: no feed entry was on disk yet', 'WARN')
        return []
    return rated


def tmdb_token():
    """Token from the environment, else from the vault's .env.

    The .env currently names it TVDB_API_KEY, which is a misnomer -- the value is
    a TMDB v4 read access token -- so accept either spelling.
    """
    for var in ('TMDB_TOKEN', 'TMDB_API_KEY', 'TVDB_API_KEY'):
        val = os.environ.get(var, '').strip()
        if val:
            return val
    try:
        for line in open(os.path.join(VAULT, '.env'), encoding='utf-8', errors='ignore'):
            line = line.strip()
            if not line or line.startswith('#') or '=' not in line:
                continue
            k, _, v = line.partition('=')
            if k.strip() in ('TMDB_TOKEN', 'TMDB_API_KEY', 'TVDB_API_KEY'):
                return v.strip().strip('"').strip("'")
    except OSError:
        pass
    return ''


def main():
    global QUIET
    diary_only = '--diary-only' in sys.argv     # frequent poll: diary + enrichment + people, no watchlist scrape or scores
    QUIET = diary_only
    from film_store import Busy, lock
    # Held from before the notes are read to the end of the run; nothing sync() calls takes it again.
    try:
        with lock(blocking=not diary_only):     # the full run waits its turn; the poll comes round again in 5 minutes
            sync(diary_only)
    except Busy:
        log('another job is writing film notes - skipping this poll')


def sync(diary_only):
    with open(CONFIG, encoding='utf-8') as fh:
        cfg = json.load(fh)
    username = cfg['username']
    from film_store import FILMS_REL, SHOWS_REL, Store
    store = Store(os.path.join(VAULT, FILMS_REL))

    entries = parse_entries(fetch_feed(username))
    log(f'feed: {len(entries)} diary entries for {username}')

    # TV lives in the Serializd show notes (serializd_sync.py), Letterboxd is for movies: a diary entry that a show note
    # already holds (moved there with its guid), or that names a show in that folder, never becomes a film note.
    shows = Store(os.path.join(VAULT, SHOWS_REL))
    have = set(store.guids)
    new = [e for e in entries if e['guid'] not in have and e['guid'] not in shows.guids
           and not (not e['tmdbId'] and shows.find(title=e['filmTitle'], year=e['filmYear'] or None))]

    # No overlap between feed and disk means the gap may exceed the feed window.
    if have and entries and not any(e['guid'] in have for e in entries):
        log(f'no feed entry matches an existing note - a gap longer than the '
            f'~{len(entries)}-entry feed window is possible; entries older than the '
            f'feed need a CSV export to recover', 'WARN')

    created = 0
    rated = []                                  # new entries that carry a rating: those films are done with
    for e in sorted(new, key=lambda x: x['watchedDate']):
        r = e['userRatingNo']
        film = store.upsert(e['filmTitle'], e['filmYear'] or None,
                            tmdb_id=int(e['tmdbId']) if e['tmdbId'] else None, poster=e['posterUrl'] or None)
        # Letterboxd's 0-5 in half steps, stored doubled (1-10) as the old notes did.
        if not store.add_watch(film, e['watchedDate'], rating=int(r * 2) if r is not None else None, guid=e['guid'],
                               url=e['link'], review=e['review'], rewatch=e['rewatch']):
            continue
        film.save()
        created += 1
        if r is not None and e['tmdbId']:
            rated.append(e)
        log(f"created watch {e['watchedDate']} on {os.path.basename(film.path)}")

    log(f'{created} created, {len(entries) - len(new)} already present')

    # A rated film leaves the watchlist and Radarr (its file stays).
    try:
        from letterboxd_rated import forget_rated
        forget_rated(confirmed_rated(rated, entries, have), store, log)
    except Exception as exc:                    # the diary sync already succeeded
        log(f'rated cleanup failed: {exc}', 'ERROR')

    token = tmdb_token()
    if not token:
        log('no TMDB token in env or vault .env - skipping enrichment, people and scores', 'WARN')
    else:
        try:
            filled, skipped, failed = enrich(store, token)
            log(f'enrichment: {filled} filled, {skipped} known-no-match skipped, {failed} errors')
        except Exception as exc:
            log(f'enrichment failed: {exc}', 'ERROR')

    if not diary_only:
        from letterboxd_watchlist import sync_watchlist
        try:
            sync_watchlist(username, store, token, log, skip=set(shows.by_slug))
        except Exception as exc:                # diary sync already succeeded
            log(f'watchlist sync failed: {exc}', 'ERROR')

    if token:
        import movie_recs as mr
        try:
            import people
            people.run(store, mr.tmdb, people.People(os.path.join(VAULT, people.PEOPLE_REL),
                                                     os.path.join(VAULT, people.INDEX_REL)), log=log,
                       also=[Store(os.path.join(VAULT, SHOWS_REL))])     # TV shows count toward a person's note too
        except Exception as exc:
            log(f'people sync failed: {exc}', 'ERROR')
        if not diary_only:
            try:
                import scores
                scores.refresh(store, lambda tmdb_id, rt_url: scores.lookup(tmdb_id, rt_url, tmdb=mr.tmdb), log=log)
            except Exception as exc:
                log(f'score refresh failed: {exc}', 'ERROR')

    if not diary_only:
        log('done')


if __name__ == '__main__':
    try:
        main()
    except Exception as exc:
        log(f'FAILED: {exc}', 'ERROR')
        sys.exit(1)
