#!/usr/bin/env python3
"""Public scores for film notes: Letterboxd average, Rotten Tomatoes critics and audience, IMDb rating.

Every film note refreshes once a week, on its own `score_day` (0 = Monday): the weekday its
note was created, so the work is spread across the week. There is no catch-up; a film missed
one week (machine off, site down) is picked up the next.

  scores.py            refresh the films due today (the 09:00 sync does this itself)

Neither site has an API. Letterboxd's film page carries the average in its JSON-LD; the Rotten
Tomatoes slug comes from Wikidata (P1258) via TMDB's external ids, since guessing slugs picks the
wrong remake. The slug is looked up once and kept on the note as `rt_url`.
"""
from __future__ import annotations

import json
import os
import re
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import date

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

WEB_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
WORKERS = 3


def web(url):
    try:
        req = urllib.request.Request(url, headers={'User-Agent': WEB_UA, 'Accept-Language': 'en-US,en;q=0.9'})
        with urllib.request.urlopen(req, timeout=25) as r:
            return r.read().decode('utf-8', 'replace')
    except Exception:
        return ''


def letterboxd_avg(tmdb_id, fetch=web):
    """Members' weighted average, 0-5, from the film page's JSON-LD (the /tmdb/ URL redirects to it)."""
    m = re.search(r'"aggregateRating":\{[^}]*?"ratingValue":([\d.]+)', fetch(f'https://letterboxd.com/tmdb/{tmdb_id}/'))
    return round(float(m.group(1)), 2) if m else None


def rt_page(tmdb_id, tmdb, fetch=web):
    """The film's Rotten Tomatoes URL, or None when Wikidata has no slug for it."""
    q = (tmdb(f'/movie/{tmdb_id}/external_ids') or {}).get('wikidata_id')
    if not q:
        return None
    try:
        claim = json.loads(fetch(f'https://www.wikidata.org/wiki/Special:EntityData/{q}.json'))['entities'][q]['claims']['P1258'][0]
        return 'https://www.rottentomatoes.com/' + claim['mainsnak']['datavalue']['value']     # e.g. "m/talk_to_me_2022"
    except (ValueError, KeyError, IndexError, TypeError):
        return None


def rotten_tomatoes(url, fetch=web):
    """-> (critics %, audience %); either is None when the page does not give it."""
    page = fetch(url) if url else ''
    pick = lambda key: (lambda m: int(m.group(1)) if m else None)(re.search(r'"%s":\{[^}]*?"score(?:Percent)?":"(\d+)%%?"' % key, page))
    return pick('criticsScore'), pick('audienceScore')


def omdb_key():
    """OMDB_API_KEY from the environment, else the vault's .env; '' when neither has it (IMDb is then skipped)."""
    val = os.environ.get('OMDB_API_KEY', '').strip()
    if val:
        return val
    try:
        import movie_recs as mr
        for line in open(os.path.join(mr.VAULT, '.env'), encoding='utf-8', errors='ignore'):
            k, _, v = line.strip().partition('=')
            if k.strip() == 'OMDB_API_KEY':
                return v.strip().strip('"\'')
    except OSError:
        pass
    return ''


def imdb(tmdb_id, tmdb, fetch=web, key=None):
    """-> (IMDb rating 0-10, title URL). TMDB's external ids give the tt id; OMDb (an API, not a scrape) the rating,
    so without an OMDB_API_KEY only the URL comes back."""
    imdb_id = (tmdb(f'/movie/{tmdb_id}/external_ids') or {}).get('imdb_id') if tmdb else None
    if not imdb_id:
        return None, None
    url = f'https://www.imdb.com/title/{imdb_id}/'
    key = omdb_key() if key is None else key
    try:
        val = json.loads(fetch(f'https://www.omdbapi.com/?i={imdb_id}&apikey={key}') if key else '{}').get('imdbRating')
        return (float(val) if val and val != 'N/A' else None), url
    except (ValueError, TypeError, AttributeError):
        return None, url


def lookup(tmdb_id, rt_url=None, tmdb=None, fetch=web):
    """-> {'lb', 'rt', 'aud', 'rt_url', 'imdb', 'imdb_url'} for a TMDB movie; anything that could not be read is None."""
    rt_url = rt_url or (rt_page(tmdb_id, tmdb, fetch) if tmdb else None)
    rt, aud = rotten_tomatoes(rt_url, fetch)
    rating, imdb_url = imdb(tmdb_id, tmdb, fetch)
    return {'lb': letterboxd_avg(tmdb_id, fetch), 'rt': rt, 'aud': aud, 'rt_url': rt_url, 'imdb': rating, 'imdb_url': imdb_url}


def due(store, today):
    day = today.isoformat()
    return [f for f in store.films
            if f.fm.get('score_day') == today.weekday() and f.fm.get('tmdb_id') and f.kind == 'movie'
            and str(f.fm.get('scores_checked') or '') != day]


def refresh(store, look, today=None, log=print):
    """Refresh the films whose score_day is today. look(tmdb_id, rt_url) -> lookup()'s dict. -> (due, updated)."""
    today = today or date.today()
    films = due(store, today)

    def one(film):
        try:
            return film, look(int(film.fm['tmdb_id']), film.fm.get('rt_url'))
        except Exception:                       # one film's bad page must not stop the rest
            return film, None

    updated = 0
    with ThreadPoolExecutor(WORKERS) as ex:
        results = list(ex.map(one, films))
    for film, s in results:
        if not s:
            continue
        if not film.reload():                   # the scrape took minutes: keep what the dashboard, the poll or a hand edit wrote meanwhile
            continue                            # gone, or caught mid-write: saving would re-create it or stub it; next week
        store.set_scores(film, lb=s['lb'], rt=s['rt'], aud=s['aud'], rt_url=s['rt_url'], today=today.isoformat(),
                         imdb=s.get('imdb'), imdb_url=s.get('imdb_url'))
        updated += film.save()
    log(f'scores: {len(films)} due, {updated} updated')
    return len(films), updated


if __name__ == '__main__':
    import movie_recs as mr
    from film_store import FILMS_REL, Store, lock
    with lock():                                # refresh() itself takes no lock: the 09:00 sync calls it holding this one
        refresh(Store(os.path.join(mr.VAULT, FILMS_REL)), lambda i, u: lookup(i, u, tmdb=mr.tmdb))
