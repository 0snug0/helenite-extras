# Set up the Movies & TV vault

You are setting up a new vault made from the **Movies & TV** template. Work through the steps in order. Ask the user each question as a widget, one step at a time, and never read, print or copy a secret value: the user types secrets into Helenite themselves.

Read `CLAUDE.md` at the vault root first. It explains the note shapes and which files are state.

## 1. Accounts

Ask for:

- the **Letterboxd username** (required; the diary feed is `https://letterboxd.com/<username>/rss/`);
- the **Serializd username** (optional; leave it empty for a films-only vault).

Write both into `99_Internal/Templates/Scripts/letterboxd_config.json`:

```json
{
 "username": "<letterboxd>",
 "serializd_username": "<serializd or empty>"
}
```

## 2. TMDB token

Every script needs a TMDB **v4 read access token** (themoviedb.org → Settings → API). Ask the user to put it in a `.env` file at the vault root as `TMDB_TOKEN=<token>`, typing it themselves. `.env` is git-ignored. Optional in the same file: `OMDB_API_KEY` (IMDb scores), `RADARR_API_KEY`, `RADARR_URL`, `SONARR_API_KEY`.

## 3. First sync

Check the scripts work here before anything else:

```bash
cd 99_Internal/Templates/Scripts && python3 -m unittest discover -p 'test_*.py'
```

Then run the first import from the vault root:

```bash
python3 99_Internal/Templates/Scripts/letterboxd_daily.py
```

It creates `50_Personal/Letterboxd/Films/<Title> (<Year>).md` for every film in the diary feed (the feed holds the last ~50 entries; for older history, ask the user for a Letterboxd CSV export and say that backfill is a separate step). If a Serializd username was given, also run `python3 99_Internal/Templates/Scripts/serializd_sync.py`. Then `python3 99_Internal/Templates/Scripts/movie_releases.py` fills the New & Upcoming row.

## 4. Apps

The vault ships three apps in `Apps/`: **Home** (dashboard), **Downloadrr** (films: Radarr, SABnzbd, Plex) and **Downloadrr TV** (shows: Sonarr, SABnzbd, Plex). Install the launcher entries and the Apps sidebar by copying the files under `setup/helenite/` into `.helenite/` at the same relative paths (`setup/helenite/plugins/core-apps/data.json` → `.helenite/plugins/core-apps/data.json`, `setup/helenite/workspace.json` → `.helenite/workspace.json`). If `.helenite/workspace.json` already exists, ask before replacing it.

Ask which services the user runs. For each app they want, tell them to open **Settings → Secrets** and enter the keys themselves (`RADARR_API_KEY`, `SONARR_API_KEY`, `SABNZBD_API_KEY`, `PLEX_TOKEN`, `TMDB_TOKEN`, optional `OMDB_API_KEY`), and to change the service URLs in the app's settings if they are not the defaults (Radarr `:7878`, Sonarr `:8989`, SABnzbd `:8080`, Plex `:32400`). Home's calendar card needs the Google account connected in Settings → Accounts; it is optional.

## 5. Background jobs (macOS)

Only if the user said yes. `99_Internal/launchd/*.plist` are launchd agents with placeholders:

| Placeholder | Value |
| --- | --- |
| `{{LABEL_PREFIX}}` | a reverse-DNS prefix ending in a dot, e.g. `local.movie-tv.` |
| `{{PYTHON}}` | an absolute python3 path launchd can use. Prefer Homebrew's (`/opt/homebrew/bin/python3`): `/usr/bin/python3` forwards to Xcode's, which launchd can't use to read `~/Documents`. |
| `{{VAULT}}` | the vault's absolute path |
| `{{LOGS}}` | `~/Library/Logs`, written out in full |

For each agent the user wants (`letterboxd-sync` daily, `letterboxd-poll` every few minutes, `letterboxd-watchlist` hourly, `movie-releases` weekly, `serializd-sync` hourly and only with a Serializd username), write the filled copy to `~/Library/LaunchAgents/<prefix><name>.plist`, show the user the `launchctl load` command for each, and let them run it. Don't load agents yourself.

## 6. Daily picks (optional)

`movie_recs.py` writes the daily recommendations Home shows. It is meant to be driven by a scheduled Claude task: `python3 99_Internal/Templates/Scripts/movie_recs.py context` prints the taste profile and candidate pools, the agent picks 10 films into `99_Internal/Data/movie-recs-draft.json`, and `movie_recs.py write 99_Internal/Data/movie-recs-draft.json` validates and publishes them. Offer to set that up; skip it if the user doesn't want it.

## 7. Finish

Open the Home app, tell the user what was set up and what was skipped, and delete this `setup/` folder only if they agree.

## 8. Migrating from the three old apps (Home, Downloadrr, DownloadrrTV)

`node setup/migrate-to-media.mjs <vault> [--dry-run]` copies the old apps' stores (`.helenite/apps/{home,downloadrr,downloadrr-tv}/store.json`) into the Media app's store under its prefixed key names. It never overwrites a key Media already has, never touches the old files and is safe to run twice. The user's real vault is `~/Helenite/media`: run it on a copy first with `--dry-run`, read the three lists, then run it for real. Close Helenite first: the app rewrites store.json while Media is open. API keys live in the keychain and cannot be migrated: the user re-enters them once on the Media Settings page.
