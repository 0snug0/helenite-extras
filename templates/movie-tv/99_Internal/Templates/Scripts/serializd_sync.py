#!/usr/bin/env python3
"""TV shows from Serializd (the TV Letterboxd) into the vault: one note per show in 50_Personal/Serializd/Shows/.

Letterboxd is for movies and Serializd for TV. A show note has the film note's format (film_store.py), with
Type "Show" and tmdb_type "tv", so the views and people.py read both alike:
  - every Serializd diary entry is a watch (`watches` / `ratings` / `letterboxd_guids` in step), with a
    "### date S01E05 Episode ★★★½" section under "## Watches" holding the review. The guid is
    "sz:<diary id>:<S01E05 | S01>", so the episode can be read back from the frontmatter;
  - `on_watchlist` / `watchlist_added` and `watching` / `watching_added` follow the Serializd lists;
  - title, first-air year and poster come from TMDB (/tv/{id}), credits from /tv/{id}/aggregate_credits
    through people.run, which also creates person notes counting films and shows together.

Serializd's www site is behind Cloudflare; its web app's API host is not and only wants the app's header.
Runs hourly ({{LABEL_PREFIX}}serializd-sync); holds film_store.lock() like every other writer of these notes.
"""
from __future__ import annotations

import json
import os
import sys
import urllib.request
from datetime import date

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from film_store import FILMS_REL, SHOWS_REL, Store  # noqa: E402

def _config_user():
    """serializd_username from letterboxd_config.json beside this script ('' when unset)."""
    try:
        with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'letterboxd_config.json'), encoding='utf-8') as fh:
            return json.load(fh).get('serializd_username', '')
    except (OSError, ValueError):
        return ''


USER = _config_user()
API = 'https://serializddesktop.onrender.com/api'
HEADERS = {'X-Requested-With': 'serializd_vercel', 'Accept': 'application/json', 'User-Agent': 'vault-serializd-sync'}
POSTER = 'https://image.tmdb.org/t/p/w500'
SHOW_URL = 'https://www.serializd.com/show/{}'


def fetch_json(path, timeout=90):
    req = urllib.request.Request(f'{API}{path}', headers=HEADERS)
    with urllib.request.urlopen(req, timeout=timeout) as r:      # Render can take a while to wake
        return json.load(r)


def pages(get, path_for, key, limit=100):
    items = []
    for page in range(1, limit + 1):
        data = get(path_for(page)) or {}
        batch = data.get(key) or []
        items += batch
        if not batch or page >= (data.get('totalPages') or 1):
            break
    return items


def fetch_all(user=USER, get=fetch_json):
    """-> (watchlist items, currently-watching items, diary reviews), raw from the API."""
    return (pages(get, lambda p: f'/user/{user}/watchlistpage_v2/{p}?sort_by=date_added_desc', 'items'),
            pages(get, lambda p: f'/user/{user}/currently_watching_page/{p}?sort_by=date_added_desc', 'items'),
            pages(get, lambda p: f'/user/{user}/diary?page={p}', 'reviews'))


def episode_code(season, episode):
    return f'S{season:02d}E{episode:02d}' if episode is not None else f'S{season:02d}'


def diary_watches(reviews):
    """Diary reviews -> [{show_id, name, day, rating, guid, review, rewatch, what}], skipping entries without a known season."""
    out = []
    for r in reviews:
        season = next((s for s in r.get('showSeasons') or [] if s.get('id') == r.get('seasonId')), None)
        if not r.get('showId') or not r.get('id') or season is None:
            continue
        ep = r.get('episodeNumber') if isinstance(r.get('episodeNumber'), int) else None
        code = episode_code(season['seasonNumber'], ep)
        rating = r.get('rating')
        out.append({
            'show_id': int(r['showId']), 'name': r.get('showName') or '',
            'day': str(r.get('backdate') or r.get('dateAdded') or '')[:10],
            'rating': int(rating) if isinstance(rating, (int, float)) and rating > 0 else None,   # Serializd: 0-10, like ratings here
            'guid': f"sz:{r['id']}:{code}",
            'review': r.get('reviewText') or '', 'rewatch': bool(r.get('isRewatch')),
            'what': f"{code} {r.get('episodeName') or ''}".strip() if ep is not None else (season.get('name') or code),
        })
    return [w for w in out if w['day']]


def show_note(store, tmdb, show_id, name, today):
    """The show's note, created from TMDB's /tv/{id} (title, first-air year, poster) when there is none."""
    note = store.find(show_id, 'tv')
    if note is None:
        meta = tmdb(f'/tv/{show_id}') or {}
        title = meta.get('name') or name or f'TMDB {show_id}'
        year = int(meta['first_air_date'][:4]) if (meta.get('first_air_date') or '')[:4].isdigit() else None
        note = store.upsert(title, year, tmdb_id=show_id, tmdb_type='tv',
                            poster=f"{POSTER}{meta['poster_path']}" if meta.get('poster_path') else None, today=today)
    f = note.fm
    f['Type'] = 'Show'
    f['serializd_url'] = f.get('serializd_url') or SHOW_URL.format(show_id)
    return note


def sync(store, tmdb, data, today=None, log=print):
    """data: fetch_all()'s triple. -> the notes that changed."""
    today = today or date.today().isoformat()
    watchlist, watching, reviews = data
    touched = []
    names = {int(i['showId']): i.get('showName') or '' for i in [*watchlist, *watching] if i.get('showId')}
    added = 0
    for w in diary_watches(reviews):
        note = show_note(store, tmdb, w['show_id'], w['name'] or names.get(w['show_id']), today)
        if store.add_watch(note, w['day'], w['rating'], w['guid'], review=w['review'], rewatch=w['rewatch'],
                           label='Serializd entry', what=w['what']):
            added += 1
            touched.append(note)

    # The lists. Both empty while notes still say otherwise looks like an outage, not an empty account: leave them.
    flagged = [n for n in store.films if n.fm.get('on_watchlist') or n.fm.get('watching')]
    if watchlist or watching or not flagged:
        on_list = {int(i['showId']): str(i.get('dateAdded') or '')[:10] or today for i in watchlist if i.get('showId')}
        now_watching = {int(i['showId']): str(i.get('dateAdded') or '')[:10] or today for i in watching if i.get('showId')}
        for sid in {*on_list, *now_watching}:
            show_note(store, tmdb, sid, names.get(sid), today)
        for note in list(store.films):
            f, sid = note.fm, int(note.fm.get('tmdb_id') or 0)
            before = (f.get('on_watchlist'), f.get('watchlist_added'), f.get('watching'), f.get('watching_added'))
            store.set_watchlist(note, sid in on_list, on_list.get(sid))
            if sid in now_watching:
                f['watching'] = True
                f['watching_added'] = f.get('watching_added') or now_watching[sid]
            else:
                f['watching'] = False
                f.pop('watching_added', None)
            if before != (f.get('on_watchlist'), f.get('watchlist_added'), f.get('watching'), f.get('watching_added')):
                touched.append(note)
    else:
        log('watchlist and currently watching both came back empty; lists left as they were', 'WARN')

    written = sum(n.save() for n in {id(n): n for n in store.films}.values())
    log(f'{len(diary_watches(reviews))} diary entries, {added} new; {len(watchlist)} on the watchlist, '
        f'{len(watching)} currently watching; {written} show notes written')
    return touched


def main():
    import movie_recs as mr
    import people
    from film_store import lock
    from letterboxd_daily import VAULT, log

    data = fetch_all()
    with lock():
        shows = Store(os.path.join(VAULT, SHOWS_REL))
        sync(shows, mr.tmdb, data, log=log)
        people.run(shows, mr.tmdb, people.People(os.path.join(VAULT, people.PEOPLE_REL), os.path.join(VAULT, people.INDEX_REL)),
                   log=log, also=[Store(os.path.join(VAULT, FILMS_REL))])
    try:                                         # the home page's TV data (outside the lock: it writes no notes)
        import tv_home
        tv_home.main(log=log)
    except Exception as exc:
        log(f'tv-home: not refreshed: {exc}', 'WARN')
    log('serializd: done')


if __name__ == '__main__':
    main()
