---
helenite-app: 1
id: home
name: Home
version: 0.1.0
description: The vault's 00_Home dashboard as an app - movie stats, last watched, recommendations, new releases, calendar, tasks due this week, recent notes and Google Calendar.
views:
  - id: main
    title: Home
    icon: home
    entry: view.js
    style: view.css
    placement: [tab, embed]
settings: {}
secrets: []
net:
  # posters
  - https://image.tmdb.org
  - https://a.ltrbxd.com
  # Google Calendar connector (OAuth tokens are connector-owned, kept in the keychain)
  - https://www.googleapis.com
  - https://oauth2.googleapis.com
connectors: [google-calendar]
vault:
  read:
    - "50_Personal/Letterboxd/Films/**"
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
    - "99_Internal/Data/movie-recs-blocked.json"
---
# Home

Port of `00_Home/00_Home.md` (DataviewJS views `movie-stats`, `movie-row`, `movie-recs`, `movie-calendar`) plus the
tasks / recent notes / Google Calendar panels, as a Helenite app package.

- **Data**: film notes through `api.notes.query` (frontmatter as a database); the daily picks and weekly releases are the
  JSON files the vault's scripts already write (read only).
- **Writes** (same as the DataviewJS views did): `+ Obsidian` sets `pending` on a film note (or creates one in
  `film_store.py`'s shape); `✕` appends to `movie-recs-blocked.json`.
- **Google Calendar**: shows "connect your calendar" until the `google-calendar` connector is authorised.
- **Never reads** `00_Home/` (it holds a secrets file), `.env`, or `.obsidian`.

Tests: `node --test Apps/Home/tests/`.
