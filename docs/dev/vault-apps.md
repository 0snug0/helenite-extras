# Vault apps

A vault app is a small app that lives in a vault, as a folder of plain files: a manifest, ES modules and CSS. Helenite runs each view in a sandboxed frame and gives it a capability `api` for the vault, storage, the network and the workspace, limited to what its manifest declares and the user approved. Use an app when you want a dashboard or tool inside a vault that is safe to share; use a plugin when you need the whole Obsidian API.

Start from the template: `node packages/create-helenite/bin.mjs my-app --template app --name "My App"`. It writes `app.md`, `view.js`, `view.css` and `ui-kit.js`.

## The folder

```
<vault>/Apps/My App/
  app.md       manifest (frontmatter) and the app's own docs (body)
  view.js      export default async function mount(root, api) → cleanup function
  view.css     the view's CSS
  ui-kit.js    @helenite/ui-kit, bundled (from the template)
  jobs/*.js    background jobs, if any: export default async function run(api, { log, job })
```

Helenite finds every folder under `<vault>/Apps` with an `app.md` and watches it: adding an app, or saving a file in one, reloads it in open views. "Apps: Rescan apps" rescans by hand. A manifest error is reported for that folder and the others still load.

## app.md

```yaml
---
helenite-app: 1
id: my-app
name: My App
version: 0.1.0
description: What it does.
theme: inherit
views:
  - id: main
    title: My App
    icon: app-window
    entry: view.js
    style: view.css
    placement: [tab, embed, sidebar]
net: ["https://api.example.com"]
vault: { read: ["Projects/**"], write: ["Projects/Notes/**"] }
secrets: [{ name: EXAMPLE_TOKEN, hosts: ["https://api.example.com"], required: true }]
settings: { pageSize: { default: 20, label: Rows per page } }
---
# My App
What it does, for people reading the note.
```

| Key | Meaning |
| --- | --- |
| `helenite-app` | Must be `1`. |
| `id` | Lowercase letters, digits and hyphens, starting with a letter (`^[a-z][a-z0-9-]{1,40}$`). |
| `name`, `version`, `description` | Shown to the user. |
| `views` | At least one. `id`, `title`, `icon`, `entry` (default `view.js`) and `style` are paths inside the app folder; `placement` is any of `tab`, `embed`, `sidebar`, `dock` (default `[tab]`). |
| `theme` | `inherit` (default) or `isolate`: whether the frame loads the user's theme and snippets ([themes.md](./themes.md#what-reaches-vault-apps)). Anything else is an error. |
| `net` | Bare origins (`https://host:port`) the app may fetch from, matched exactly. |
| `vault.read`, `vault.write` | Globs of vault paths the app may read and write. |
| `secrets` | Names in UPPER_SNAKE, each bound to `hosts` from `net`: the only places the value is ever sent. |
| `settings` | Values the app reads from `api.settings`, each with a `default` and a `label`. |
| `connectors`, `data` | Connector ids and data contract ids the app uses through `api.connectors.<id>` and `api.data`. |
| `agent` | `true` to send messages to the user's agent with `api.agent.ask`. |
| `jobs`, `agentJobs` | Background jobs (`id`, `entry`, `every: 30m`, `timeout`) and headless agent runs. |
| `trust` | Only `sandboxed` is supported. |

The parser is `packages/apps-runtime/src/manifest/parse.ts`, and `packages/apps-runtime/src/manifest/schema.json` is the JSON Schema. The first time an app opens, and whenever its permissions change (trust, `net`, `vault`, `secrets`, `connectors`, `data`, `agent`, jobs), Helenite asks the user to approve them. A denied app stays closed until the user reviews its permissions again.

## Where an app appears

- In a tab or sidebar: the command "Apps: Open app…".
- In a note: a fenced block whose language is `helenite-app`, followed by the app id:

  ````md
  ```helenite-app my-app
  ```
  ````

- In the Apps pane of the left sidebar ("Apps: Show apps").

## The view

```js
import { button, setBridge } from "./ui-kit.js";

export default async function mount(root, api) {
  setBridge(api);
  button(root, { text: "Refresh", onClick: () => load() });
  return () => { /* stop timers, close sockets */ };
}
```

Helenite imports `entry` as an ES module and calls its default export with `root` (the element to draw into) and `api`. Return a function to run when the view closes. A throw shows "<name> failed to start" in the view.

### The capability api

| Call | Needs |
| --- | --- |
| `api.vault.read(path)`, `api.vault.list(glob)` | a matching `vault.read` glob |
| `api.vault.write(path, text)` | a matching `vault.write` glob |
| `api.notes.query({ from, where })` | `vault.read`; returns `[{ path, basename, frontmatter, mtime }]` |
| `api.notes.update(path, patch)` | `vault.write`; patches frontmatter (`null` deletes a key) |
| `api.store.get(key)`, `set`, `delete`, `all` | nothing: the app's own JSON store |
| `api.net.fetch({ url, method, headers, body })` | the origin in `net`. Runs in the main process, so CORS does not apply. `{{secret:NAME}}` in the url, a header or a string body is filled in for the secret's hosts. |
| `api.secrets.status()`, `api.secrets.prompt(name)` | a declared secret. There is no way to read a secret's value. |
| `api.workspace.openNote(path)` | `vault.read` |
| `api.workspace.openUrl(url)`, `api.workspace.openApp(id)` | nothing (`http` and `https` links only) |
| `api.connectors.<id>.<method>(...)` | the id in `connectors` |
| `api.data.list(contract)`, `api.data.act(contract, action, record)` | the contract in `data` |
| `api.agent.ask(text)` | `agent: true` |
| `api.settings`, `api.app`, `api.view` | nothing: read-only values |

Every call is a message to the host, checked against the manifest in the main process. A refused call rejects with an error. The frame-side api is `packages/apps-runtime/src/sandbox/api.js`, and the checks are in `packages/apps-runtime/src/main/broker.ts`.

## The UI kit

`@helenite/ui-kit` gives apps the design-system parts. A frame cannot resolve package names, so an app imports a bundled copy by relative path; the template's `ui-kit.js` is one, made by create-helenite from `packages/ui-kit`.

- **The parts that draw into the page** are the same functions as `ui.*` in plugins, with the same `(parent, options)` signatures: `button`, `segmented`, `table`, `emptyState`, `errorState`, `loadingState`, `badge`, `statusDot`, `statusText`, `countBadge`, `chip`, `field`, `textInput`, `searchInput`, `slider`, `toggle`, `dropdown`, `tabs`, `toolbar`, `callout`, `card`, `checkList`, `choiceList`, `listRow`, `listGroup`, `composer`, `keyValue`. Every frame loads the design-system stylesheet, so they need no CSS from the app.
- **The kit's own parts** (`cardGrid`, `posterRow`, `picker`, `calendarStrip`) need `packages/ui-kit/src/ui-kit.css`: copy it into the app and `@import` it from `view.css`.
- **Icons**: a frame has no Obsidian icon set. The kit draws the standard action icons and a few more (`more-horizontal`, `chevron-right`, `chevron-down`, `check`, `plus`, `search`) as inline SVG; other names only set `data-icon`. Pass your own renderer to `setIconRenderer` for more.
- **Overlays** go through the host: call `setBridge(api)` first, or they throw.
  - `notice(text)` works today, but the host drops its options for now, so `kind` and `timeoutMs` are ignored.
  - `confirm`, `prompt`, `choose`, `form` and `menu` (and a `listRow`'s `menu`) need the host to draw app modals and menus, which is not built yet, so they do not open in an app today. Their signatures are final; code written against them will work when that lands. `prompt` has no `validate`, because a callback cannot cross the bridge.

The kit's reference is `packages/ui-kit/README.md`, and the parts are in [docs/design-system/README.md](../design-system/README.md#vault-apps).

## The sandbox

Each view runs in an `<iframe sandbox="allow-scripts">` with an opaque origin, under a content security policy set for that app:

- Scripts load only from the app's own folder and Helenite's frame host (no inline scripts); styles likewise, plus inline styles.
- No network from the frame (`connect-src 'none'`): `fetch`, XHR and WebSockets are blocked. Use `api.net.fetch`.
- No forms that submit, no plugins (`object-src`), and no nested frames.
- Images only from `data:`, `blob:` and the origins in `net`. Fonts only from `data:`.
- No Node, no `require`, no access to the host page's DOM, no popups, and no `localStorage`. Use `api.store`.

The policy is built in `packages/apps-runtime/src/host/frame.ts`. Background jobs run in a hidden frame with the same api and the same limits.

## Testing an app

A view is an ES module with a default export, so you can test it with vitest under jsdom: import `view.js`, call it with a root element and a fake `api` (an object with the calls the view uses), and check the DOM. `plugins/core-build/test/create-helenite.test.ts` does this for the template. See [testing.md](./testing.md).
