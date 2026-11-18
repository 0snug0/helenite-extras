#!/usr/bin/env python3
"""Resolve Letterboxd diary titles to TMDB movie ids + poster paths.

Conservative matcher: only accepts a candidate whose normalized title matches
exactly and whose release year is within tolerance. Anything ambiguous is left
unmatched rather than guessed, since a wrong poster is worse than none.
"""
import json, os, re, sys, time, unicodedata, urllib.parse, urllib.request

API = 'https://api.themoviedb.org/3'
POSTER_SIZE = 'w500'          # matches the plugin's own posterUrlL
IMG = 'https://image.tmdb.org/t/p'


def token():
    for line in open(os.path.join(os.path.dirname(__file__), '..', '.env'), errors='ignore'):
        pass
    raise SystemExit('unused')


def norm(s):
    """Fold case, strip accents and punctuation, collapse whitespace."""
    s = unicodedata.normalize('NFKD', s)
    s = ''.join(c for c in s if not unicodedata.combining(c))
    s = s.lower().replace('&', 'and')
    s = re.sub(r'[^a-z0-9]+', ' ', s)
    return ' '.join(s.split())


def get(path, params, tok, tries=4):
    url = f'{API}{path}?' + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={
        'Authorization': f'Bearer {tok}', 'accept': 'application/json'})
    for attempt in range(tries):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code == 429:
                time.sleep(2 * (attempt + 1)); continue
            if e.code == 404:
                return None
            raise
        except Exception:
            if attempt == tries - 1:
                raise
            time.sleep(1.5 * (attempt + 1))
    return None


def year_of(cand):
    d = cand.get('release_date') or ''
    return int(d[:4]) if len(d) >= 4 and d[:4].isdigit() else None


def pick(title, year, tok):
    """Return (tmdb_id, poster_path, how) or (None, None, reason).

    Unions a year-constrained and an unconstrained search, keeps only
    candidates whose normalized title matches exactly, then prefers the
    closest release year (exact, then +/-1) and breaks ties on vote count.
    A title with no exact match inside that window is left unmatched -- TMDB
    has unrelated films sharing titles with TV miniseries like "Band of
    Brothers", and the plugin leaves those blank too.
    """
    want = norm(title)

    cands = {}
    for params in ({'query': title, 'primary_release_year': year, 'include_adult': 'true'},
                   {'query': title, 'include_adult': 'true'}):
        res = get('/search/movie', params, tok) or {}
        for c in res.get('results', []):
            if norm(c.get('title', '')) == want or norm(c.get('original_title', '')) == want:
                cands[c['id']] = c

    if not cands:
        return None, None, 'no-exact-title'

    # Letterboxd's year is the festival/premiere year while TMDB often carries
    # the wide-release year, so allow +/-1 and rank by vote count -- an obscure
    # same-title film should not beat the one the user actually watched.
    window = [c for c in cands.values()
              if year_of(c) is not None and abs(year_of(c) - year) <= 1]
    if window:
        best = max(window, key=lambda c: (c.get('vote_count', 0),
                                          -abs(year_of(c) - year),
                                          c.get('popularity', 0)))
        label = 'year-exact' if year_of(best) == year else 'year±1'
        if len(window) > 1:
            label += f' ({len(window)} cands)'
        return best['id'], best.get('poster_path'), label

    return None, None, f'title-ok-but-year-off({sorted(filter(None,(year_of(c) for c in cands.values())))[:4]})'


def poster_url(path):
    return f'{IMG}/{POSTER_SIZE}{path}' if path else ''
