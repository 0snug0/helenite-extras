---
helenite-app: 1
id: media
name: Media
version: 0.1.0
theme: inherit
description: Home, Movies, TV and Settings in one app - dashboard, watchlist downloads through Radarr, Sonarr, SABnzbd and Plex, and a settings page for the services and keys.
views:
  - id: main
    title: Media
    icon: clapperboard
    entry: view.js
    style: view.css
    placement: [tab, embed, sidebar]
settings:
  RADARR_URL: { default: "http://localhost:7878", label: Radarr URL }
  SONARR_URL: { default: "http://localhost:8989", label: Sonarr URL }
  SABNZBD_URL: { default: "http://localhost:8080", label: SABnzbd URL }
  PLEX_URL: { default: "http://localhost:32400", label: Plex URL }
  TMDB_URL: { default: "https://api.themoviedb.org", label: TMDB API URL }
  SCRAPE_SCORES: { default: true, label: "Scrape Letterboxd, Serializd and Rotten Tomatoes scores" }
secrets:
  - { name: RADARR_API_KEY, label: Radarr API key, hosts: ["http://localhost:7878"] }
  - { name: SONARR_API_KEY, label: Sonarr API key, hosts: ["http://localhost:8989"] }
  - { name: SABNZBD_API_KEY, label: SABnzbd API key, hosts: ["http://localhost:8080"] }
  - { name: PLEX_TOKEN, label: Plex token, hosts: ["http://localhost:32400"] }
  - { name: TMDB_TOKEN, label: TMDB read access token (v4), hosts: ["https://api.themoviedb.org"] }
  - { name: OMDB_API_KEY, label: OMDb API key (optional, IMDb scores), hosts: ["https://www.omdbapi.com"] }
net:
  # the real services
  - http://localhost:7878
  - http://localhost:8989
  - http://localhost:8080
  - http://localhost:32400
  - https://api.themoviedb.org
  # posters
  - https://image.tmdb.org
  - https://a.ltrbxd.com
  # score scraping (SCRAPE_SCORES)
  - https://letterboxd.com
  - https://serializddesktop.onrender.com
  - https://www.wikidata.org
  - https://query.wikidata.org
  - https://www.rottentomatoes.com
  - https://www.omdbapi.com
  # Google Calendar connector (OAuth tokens are connector-owned, kept in the keychain)
  - https://www.googleapis.com
  - https://oauth2.googleapis.com
connectors: [google-calendar]
vault:
  read:
    - "50_Personal/Letterboxd/Films/**"
    - "50_Personal/Serializd/Shows/**"
    - "99_Internal/Data/movie-recs.json"
    - "99_Internal/Data/movie-releases.json"
    - "99_Internal/Data/movie-recs-blocked.json"
    - "99_Internal/Data/history/**"
    - "10_Inbox/**"
    - "20_Contacts/**"
    - "40_Notes/**"
    - "50_Personal/Places/**"
    - "50_Personal/History/**"
  write:
    - "50_Personal/Letterboxd/Films/**"
    - "50_Personal/Serializd/Shows/**"
    - "99_Internal/Data/movie-recs-blocked.json"
jobs:
  - id: refresh-availability
    entry: jobs/refresh-availability.js
    every: 30m
    timeout: 120s
    description: Where each watchlist film streams in the US (TMDB watch providers), cached in the app store under movies:availability.
---
# Media

One app for the film and TV vault: **Home** (stats, last watched, picks, new releases, calendar, tasks, recent notes), **Movies**
(watchlist and pending films with Radarr, SABnzbd and Plex state and a release picker), **TV** (the same for shows through Sonarr)
and **Settings** (service URLs, API keys, score scraping). It replaces the old Home, Downloadrr and Downloadrr TV apps.

- **View** `main` (`view.js`): open it as a tab or the sidebar, or embed it in a note with a `helenite-app media` code block.
- **Deep links**: `helenite-app media page=tv id=<tmdbId>` opens the TV page on one show; `page=movies` and `page=home` work the same.
- **State** lives in the app store (`.helenite/apps/media/store.json`), keys prefixed `movies:` and `tv:`. Run
  `node setup/migrate-to-media.mjs <vault>` to copy the old apps' stores and settings across.
- **Settings** (service URLs, `SCRAPE_SCORES`) are in `.helenite/apps/media/settings.json`; the six API keys and tokens are entered on the
  Settings page and kept in the keychain. The view only ever sees `{{secret:NAME}}` placeholders. Every key is optional: a service
  with no key shows as not configured.
- **Job** `refresh-availability` refreshes where each watchlist film streams (TMDB) into `movies:availability` every 30 minutes.
- **Never reads** `00_Home/` (it holds a secrets file), `.env`, or `.obsidian`.
