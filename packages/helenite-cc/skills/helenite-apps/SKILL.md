---
name: helenite-apps
description: Helenite micro-app package format, capability API, connectors and jobs. Use when creating, changing or debugging an app under the vault's Apps folder.
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
