---
name: helenite-apps
description: Helenite micro-app package format, capability API, connectors and jobs. Use when creating, changing or debugging an app under the vault's Apps folder, including multi-page apps with a router and deep links.
---

# Micro-apps

An app is a folder (usually `Apps/<Name>/`) with:

```
app.md        manifest (frontmatter) + human docs
view.js       export default async function mount(root, api) → dispose
view.css      theme CSS variables only
jobs/*.js     export default async function run(api, { log }) → JSON
tests/*.test.js
```

Manifest keys: `helenite-app: 1`, `id` (`/^[a-z][a-z0-9-]{1,40}$/`), `name`, `version`, `description`, `trust: sandboxed`, `views` (`id`, `title`, `icon`, `entry`, `style`, `placement: [tab, embed, sidebar, dock]`), `settings`, `secrets` (names only, UPPER_SNAKE, with `hosts`), `net` (exact origins), `vault.read` / `vault.write` (globs), `connectors`, `jobs` (`id`, `entry`, `every`), `theme` (`inherit`, the default, loads the user's theme and snippets in the frame; `isolate` does not).

Apps run sandboxed in an iframe: no Node, no direct network, no host DOM. They use the capability `api`: `api.vault.{read,write,list}`, `api.notes.{query,update}`, `api.store.{get,set}`, `api.net.fetch` (host-scoped; secrets are bound to hosts and never readable), `api.workspace.{openNote,openApp}`, `api.notify`, `api.agent.ask(text)`, `api.connectors.<id>.*`. Embed in a note with a fenced block `helenite-app <id>`.

Tools: `app_list`, `app_open`, `app_scaffold`, `app_reload`, `app_test`, `apps_add_entry` (`mcp__helenite__*`). If one answers "not available", the app runtime is not installed yet; say so rather than hand-writing around it.

App UI: `@helenite/ui-kit` gives the design-system parts (`button`, `table`, `card`, ...) with the same signatures as plugins' `ui.*`. A frame cannot resolve package names, so an app imports a bundled copy (`./ui-kit.js`) and calls `setBridge(api)` before any overlay. Today only `notice` works through the bridge (without options); `confirm`, `prompt`, `choose`, `form` and `menu` need host support that is not built yet.

In a Helenite checkout, `node packages/create-helenite/bin.mjs <dir> --template app` writes a starter app (`app.md`, `view.js` with ui-kit, `ui-kit.js`), and `docs/dev/vault-apps.md` is the full guide (manifest keys, the `api`, the sandbox).

Plugin UI (settings tabs, modals, buttons, tables): use the `helenite` module's parts and follow `docs/design-system/README.md`; Settings, Design system shows each one live. Plugins: see the helenite-plugins skill and `docs/dev/plugins.md`.

## Multi-page apps

Build ONE app with pages, not several apps, when the screens share services, secrets or data (Home, Movies, TV and Settings are one `media` app). The user approves one permission set, a Settings page can set the keys every page uses, and a page can deep-link to another. Keep separate apps only when they are unrelated or need different permissions.

Start with `node packages/create-helenite/bin.mjs <dir> --template app-pages`. It writes `view.js` (the page list: `NAV` and `PAGES`), `view.css` (spacing tokens), `pages/home` and `pages/about`, `ui-kit.js`, and `router.js` plus `shell.js`, copied from `templates/movie-tv/Apps/Media`. Do not edit those two copies; the worked example is `Apps/Media` (small page: `pages/settings`; mount, setup state and read-only deep link: `pages/movies`). Docs: "Pages and deep links" in `docs/dev/vault-apps.md`.

**Page contract.** `pages/<id>/index.js` is `export default async function mount(el, ctx)` returning an optional cleanup (a `PageMount`). `ctx` has `api`, `go(page, params)`, `back()`, `params` (current, read when needed), `onParams(cb)` and `onHide(cb)` (each returns unsubscribe; `onHide` runs when the shell hides the page), `setStatus(service, "ok" | "down" | "unset")` for the status strip, and `store`, which is `api.store` with every key prefixed `<page>:` (pages cannot collide). Pages are imported on first visit, mounted once, then hidden and kept alive: timers, listeners and `onParams` subscriptions must be released in the cleanup, and a second visit calls `onParams` instead of remounting, so re-read `ctx.params` there. Hidden is not unmounted: a modal or overlay a page puts outside its own pane (on `document.body`) must close in `onHide`, or it stays over the next page. A page that throws (import or mount) gets an error pane with Retry; the nav keeps working, so remove anything the failed mount left behind before rethrowing. An unknown page id falls back to `home`.

**Deep links are read-only.** `openApp(id, { params })`, a note fence `helenite-app <id> page=tv id=abc` and `api.view.params` / `api.view.onNavigate(cb)` all carry params from whoever wrote a link. A page may open, focus or highlight what they name; it must NEVER mutate a service or the vault because of them (no add, delete, download, send). The Movies page once added a film from a link; do not repeat that. Param values are `[\w.:/-]{1,200}`, at most 10 keys, anything else is dropped.

**One manifest.** `net`, `vault.read`/`vault.write`, `connectors` and `secrets` are the union of what every page needs. Declare EVERY secret and setting any page uses, including the ones only the Settings page shows: the broker rejects an undeclared secret. Never mark a secret `required: true` at manifest level (one missing key would block every page); the page that needs it shows a setup state ("X is not set up yet", a button to Settings or `api.secrets.prompt(name)`) instead of failing. `api.settings` is read-only to an app and the host has no settings editor for apps, so a Settings page shows values and says which file to edit.

**Shared module state.** Every page runs in one frame and imports one copy of each `core/` module, so module-level state in `core/` (the ui-kit icon renderer, bridges, caches) is shared by every page: the last page to set it wins. Register per-page data into a shared registry (Media: `core/icons.js` `registerIcons`) instead of overwriting a global.

**Tokens.** Put spacing and sizes in one block of CSS custom properties on the shell (`--app-gap`, `--app-pad`, `--app-radius`, as in the template; Media uses `--media-*`), use only those and theme variables in page rules, and share rules through one scope class on every page root.

**Migrating older apps.** An app cannot read another app's store or secrets. Merge stores with a one-time script run on the vault (see `templates/movie-tv/setup/migrate-to-media.mjs`): copy each key as `<page>:<key>` into the new app's `.helenite/apps/<id>/store.json`, never overwrite an existing key, never touch the sources. Merge each old `settings.json` the same way (same key names). Secrets live in the keychain and cannot be copied: tell the user to set them again on the Settings page.

**Before telling the user it is done:** open the app (`app_open`), click every nav button and look at each page, trigger one setup state and one deep link (`page=<id>` on the fence), confirm the nav still works after a page fails, take a screenshot of each page, and run `app_test`. Fix what you saw, then report.

