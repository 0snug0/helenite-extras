---
helenite-app: 1
id: downloadrr-tv
name: Downloadrr TV
version: 0.1.0
description: Every TV show on the Serializd watchlist, currently watching or pending, with Sonarr status, SABnzbd progress, Plex watch state, per-season and per-episode search and a release picker.
views:
  - id: main
    title: Downloadrr TV
    icon: tv
    entry: view.js
    style: view.css
    placement: [tab, embed]
settings:
  SONARR_URL: { default: "http://localhost:8989", label: Sonarr URL }
  SABNZBD_URL: { default: "http://localhost:8080", label: SABnzbd URL }
  PLEX_URL: { default: "http://localhost:32400", label: Plex URL }
  TMDB_URL: { default: "https://api.themoviedb.org", label: TMDB API URL }
  SCRAPE_SCORES: { default: true, label: Fetch Serializd and Rotten Tomatoes scores }
secrets:
  - { name: SONARR_API_KEY, label: Sonarr API key, required: true, hosts: ["http://localhost:8989", "http://localhost:17989", "http://localhost:18989"] }
  - { name: SABNZBD_API_KEY, label: SABnzbd API key, hosts: ["http://localhost:8080", "http://localhost:18080"] }
  - { name: PLEX_TOKEN, label: Plex token, hosts: ["http://localhost:32400", "http://localhost:18400"] }
  - { name: TMDB_TOKEN, label: TMDB read access token (v4), hosts: ["https://api.themoviedb.org", "http://localhost:18083"] }
  - { name: OMDB_API_KEY, label: OMDb API key (optional, IMDb scores), hosts: ["https://www.omdbapi.com"] }
net:
  # the real services
  - http://localhost:8989
  - http://localhost:8080
  - http://localhost:32400
  - https://api.themoviedb.org
  - https://image.tmdb.org
  # score scraping (SCRAPE_SCORES)
  - https://serializddesktop.onrender.com
  - https://query.wikidata.org
  - https://www.rottentomatoes.com
  - https://www.omdbapi.com
  # mock services (ports/eric/mocks/sonarr.js, plus the spike's SABnzbd, Plex and TMDB mocks)
  - http://localhost:17989
  - http://localhost:18989   # the spike mock server's Sonarr
  - http://localhost:18080
  - http://localhost:18400
  - http://localhost:18083
vault:
  read: ["50_Personal/Serializd/Shows/**"]
  write: ["50_Personal/Serializd/Shows/**"]
connectors: [sonarr, sabnzbd, plex, tmdb]
---
# Downloadrr TV

Port of the original vault's `99_Internal/Views/downloadrr_tv` DataviewJS view (1078 lines, one closure) to a Helenite app package, with
the same behaviour. The view is split into ES modules (`actions`, `draw`, `panels`, `modal`, `active`, `search`, `polling`, `services`)
that share one context object built in `view.js`.

- **Cards** are the Serializd show notes (`50_Personal/Serializd/Shows`, written by `serializd_sync.py`) that are `on_watchlist`, `watching` or `pending`, plus every Sonarr show no note stands for. The poster opens the show on Serializd; the first score is the Serializd average.
- **State** (Sonarr id lookups, streaming availability, scraped scores, sort choices) lives in the app store, not in `99_Internal/Data/*.json` or `localStorage`.
- **Secrets** are entered in Settings → Secrets and kept in the keychain; the view only sees `{{secret:NAME}}` placeholders.
- **Watchlist x** clears `on_watchlist`/`watching`/`pending` on the note with `api.notes.update` (the Serializd sync sets them again while the show is still listed).
- `base.js` is the movie page's `lib.js` (env parsing, sizes, SABnzbd slot states, row status) and `add-search.js` the shared "find to monitor" box; both are copied here because an app only serves its own folder.

- **UI** uses `@helenite/ui-kit` (the `ui-kit.js` bundle beside the view): buttons, tables, badges, status dots, the filter control and empty/loading/error states.

TODO(J): switch to `api.connectors.{sonarr,plex,sabnzbd,tmdb}`. TODO(ui-kit): the inline season/release modal becomes ui-kit's host-rendered overlays once the host renders app modals.

Tests: `node --test Apps/DownloadrrTV/tests/`.
