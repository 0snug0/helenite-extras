---
helenite-app: 1
id: downloadrr
name: Downloadrr
version: 0.2.0
description: Every film on the Letterboxd watchlist or pending, with Radarr status, SABnzbd progress, Plex watch state and a release picker.
views:
  - id: main
    title: Downloadrr
    icon: film
    entry: view.js
    style: view.css
    placement: [tab, embed]
settings:
  RADARR_URL: { default: "http://localhost:7878", label: Radarr URL }
  SABNZBD_URL: { default: "http://localhost:8080", label: SABnzbd URL }
  PLEX_URL: { default: "http://localhost:32400", label: Plex URL }
  TMDB_URL: { default: "https://api.themoviedb.org", label: TMDB API URL }
  SCRAPE_SCORES: { default: true, label: Scrape Letterboxd and Rotten Tomatoes scores }
secrets:
  - { name: RADARR_API_KEY, label: Radarr API key, required: true, hosts: ["http://localhost:7878", "http://localhost:17878"] }
  - { name: SABNZBD_API_KEY, label: SABnzbd API key, hosts: ["http://localhost:8080", "http://localhost:18080"] }
  - { name: PLEX_TOKEN, label: Plex token, hosts: ["http://localhost:32400", "http://localhost:18400"] }
  - { name: TMDB_TOKEN, label: TMDB read token, hosts: ["https://api.themoviedb.org", "http://localhost:18083"] }
net:
  # the real services
  - http://localhost:7878
  - http://localhost:8080
  - http://localhost:32400
  - https://api.themoviedb.org
  - https://image.tmdb.org
  # score scraping (SCRAPE_SCORES)
  - https://letterboxd.com
  - https://www.wikidata.org
  - https://www.rottentomatoes.com
  # the spike's mock services
  - http://localhost:17878
  - http://localhost:18080
  - http://localhost:18400
  - http://localhost:18083
vault:
  read: ["50_Personal/Letterboxd/Films/**"]
  write: ["50_Personal/Letterboxd/Films/**"]
connectors: [radarr, sabnzbd, plex, tmdb]
jobs:
  - id: refresh-availability
    entry: jobs/refresh-availability.js
    every: 30m
    timeout: 120s
    description: Where each watchlist film streams in the US (TMDB watch providers), cached in the app store.
---
# Downloadrr

Port of the original vault's `99_Internal/Views/downloadrr` DataviewJS view to a Helenite app package.

- **View** `main` (`view.js`): embed it in a note with a `helenite-app downloadrr` code block, or open it as a tab.
- **Job** `refresh-availability`: was `refresh-availability.js` under launchd reading `.env`.
- **State** lives in the app store (`.helenite/apps/downloadrr/store.json`), not in `99_Internal/Data/*.json` or `localStorage`.
- **Secrets** are set from the app's settings and kept in the macOS keychain. The view never sees them: requests carry `{{secret:NAME}}` placeholders that the host fills in for the hosts each secret is bound to.

Tests: `node --test Apps/Downloadrr/tests/`.
