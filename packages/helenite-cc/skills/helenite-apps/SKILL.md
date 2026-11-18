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

Manifest keys: `helenite-app: 1`, `id` (`/^[a-z][a-z0-9-]{1,40}$/`), `name`, `version`, `description`, `trust: sandboxed`, `views` (`id`, `title`, `icon`, `entry`, `style`, `placement: [tab, embed, sidebar, dock]`), `settings`, `secrets` (names only, UPPER_SNAKE, with `hosts`), `net` (exact origins), `vault.read` / `vault.write` (globs), `connectors`, `jobs` (`id`, `entry`, `every`).

Apps run sandboxed in an iframe: no Node, no direct network, no host DOM. They use the capability `api`: `api.vault.{read,write,list}`, `api.notes.{query,update}`, `api.store.{get,set}`, `api.net.fetch` (host-scoped; secrets are bound to hosts and never readable), `api.workspace.{openNote,openApp}`, `api.notify`, `api.agent.ask(text)`, `api.connectors.<id>.*`. Embed in a note with a fenced block `helenite-app <id>`.

Tools: `app_list`, `app_open`, `app_scaffold`, `app_reload`, `app_test`, `apps_add_entry` (`mcp__helenite__*`). If one answers "not available", the app runtime is not installed yet; say so rather than hand-writing around it.

Plugin UI (settings tabs, modals, buttons, tables): use the `helenite` module's parts and follow `docs/design-system/README.md`; Settings, Design system shows each one live.
