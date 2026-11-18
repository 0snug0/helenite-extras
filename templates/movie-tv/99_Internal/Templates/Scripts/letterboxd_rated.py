#!/usr/bin/env python3
"""A new Letterboxd rating takes the film off the watchlist and out of Radarr (unless a file is on disk).

Called from letterboxd_daily.py on every run, with the diary entries it just
created that carry a rating. For each of those films, its film note's
`on_watchlist` and `pending` flags are cleared (the note stays) and the movie is
deleted from Radarr when it has no file. A movie that still has a file is only unmonitored and
kept, so it still shows in Downloadrr's "On disk" table and can be deleted from there.

Only a movie that was in Radarr when the rating was first seen is removed or unmonitored. A rating
is recorded once (its guid), so putting the film back on the watchlist and into
Radarr later, to rewatch it, is never undone by this. A removal that cannot finish
now (Radarr unreachable) waits in rated-pending.json with the time the rating was
seen, and is retried only for a Radarr movie whose `added` time is not later than that.

Env / vault .env: RADARR_API_KEY, RADARR_URL (default http://localhost:7878).
"""
from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from datetime import datetime, timezone

VAULT = os.environ.get('LETTERBOXD_VAULT', os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..')))
PENDING = os.path.expanduser('~/Library/Application Support/letterboxd-sync/rated-pending.json')


def _env(name, default=''):
    val = os.environ.get(name, '').strip()
    if val:
        return val
    try:
        for line in open(os.path.join(VAULT, '.env'), encoding='utf-8', errors='ignore'):
            k, _, v = line.strip().partition('=')
            if k.strip() == name and v.strip():
                return v.strip().strip('"').strip("'")
    except OSError:
        pass
    return default


class Radarr:
    def __init__(self, url, key):
        self.base = url.rstrip('/') + '/api/v3'
        self.key = key

    def _call(self, method, path, body=None):
        headers = {'X-Api-Key': self.key}
        data = None
        if body is not None:
            data = json.dumps(body).encode()
            headers['Content-Type'] = 'application/json'
        req = urllib.request.Request(self.base + path, data=data, method=method, headers=headers)
        with urllib.request.urlopen(req, timeout=30) as r:
            body = r.read()
        return json.loads(body) if body else None

    def find(self, tmdb_id):
        """The Radarr movie with this TMDB id, or None."""
        found = self._call('GET', f'/movie?tmdbId={int(tmdb_id)}')
        return found[0] if found else None

    def delete(self, movie_id):
        self._call('DELETE', f'/movie/{int(movie_id)}?deleteFiles=false&addImportExclusion=false')

    def unmonitor(self, movie):
        """Stop Radarr wanting the movie. It stays in Radarr, so a file on disk still shows in Downloadrr."""
        self._call('PUT', f'/movie/{int(movie["id"])}', {**movie, 'monitored': False})


def default_radarr():
    key = _env('RADARR_API_KEY')
    return Radarr(_env('RADARR_URL', 'http://localhost:7878'), key) if key else None


def _parse(ts):
    return datetime.fromisoformat(ts.replace('Z', '+00:00'))


def load_pending(path):
    try:
        with open(path, encoding='utf-8') as fh:
            return json.load(fh)
    except (OSError, ValueError):
        return {}


def save_pending(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    if data:
        with open(path, 'w', encoding='utf-8') as fh:
            json.dump(data, fh, indent=1)
    elif os.path.exists(path):
        os.remove(path)


def remove_from_radarr(tmdb_id, seen_at, radarr, title, log):
    """Unmonitor the movie if it was in Radarr by seen_at. Returns True when done, False to retry later."""
    try:
        movie = radarr.find(tmdb_id)
        if not movie:
            return True
        added = movie.get('added')
        if added and _parse(added) > _parse(seen_at):
            log(f'rated: {title} - in Radarr again since the rating, kept')
            return True
        if movie.get('hasFile'):
            # The file is still on disk: keep the movie in Radarr (so Downloadrr's "On disk" table lists it
            # and it can be deleted from there), just stop Radarr wanting it.
            if movie.get('monitored', True):
                radarr.unmonitor(movie)
                log(f'rated: {title} - has a file, kept in Radarr (unmonitored)')
            return True
        radarr.delete(movie['id'])
        log(f'rated: {title} - removed from Radarr (no file)')
        return True
    except (urllib.error.URLError, OSError, ValueError, KeyError) as exc:
        log(f'{title}: Radarr unmonitor postponed ({exc})', 'WARN')
        return False


def forget_rated(entries, store, log, radarr=None, pending_path=PENDING, now=None):
    """entries: newly created diary entries with a rating and a tmdbId.
    store: film_store.Store. Clears on_watchlist/pending and unmonitors each film in Radarr."""
    # Messages starting 'rated: ' are the ones the 5-minute poll lets through: something actually changed.
    now = now or datetime.now(timezone.utc).isoformat()
    radarr = radarr or default_radarr()
    pending = load_pending(pending_path)
    for e in entries:
        title = f"{e['filmTitle']} ({e['filmYear']})"
        try:
            film = store.find(tmdb_id=int(e['tmdbId']))
            if film and (film.fm.get('on_watchlist') or film.fm.get('pending')):
                store.set_watchlist(film, False)
                store.set_pending(film, False)
                film.save()
                log(f'rated: {title} - off the watchlist')
        except Exception as exc:
            log(f'{title}: could not clear the watchlist flags ({exc})', 'WARN')
        pending.setdefault(str(int(e['tmdbId'])), {'title': title, 'seen': now})

    # Includes earlier removals that had to wait.
    for tmdb_id, item in list(pending.items()):
        if radarr is None:
            log('RADARR_API_KEY not set - Radarr unmonitor postponed', 'WARN')
            break
        if remove_from_radarr(tmdb_id, item['seen'], radarr, item['title'], log):
            del pending[tmdb_id]
    save_pending(pending_path, pending)
