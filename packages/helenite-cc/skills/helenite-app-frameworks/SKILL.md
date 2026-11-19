---
name: helenite-app-frameworks
description: Author a Helenite vault app with a framework (Preact today, others as adapters) built by Vite into plain view.js and view.css, with useNotes over the user's markdown notes. Use when an app has several sections, state, or lists driven by notes, instead of hand-writing DOM code.
---

# Apps with a framework and Vite

A framework is only an authoring layer. Vite compiles `src/` into `view.js` and `view.css` beside `app.md`; the sandboxed frame loads those two files exactly as it loads a hand-written app. Manifest, permissions, CSP and `api` are unchanged. Never reach outside them: no network from the frame, no `localStorage` (use `api.store`), secrets only as `{{secret:NAME}}` through `api.net.fetch`.

## When to use it

- **Use it** for an app with more than one section, state (selected year, open panel, filters), or lists built from notes: dashboards, trackers, reading lists. The user asks for "an app from my notes".
- **Keep `--template app`** for a tiny single-card app. Keep hand-written pages that already work (Media's other pages); migrate them one page at a time, only when asked.
- Pages of a multi-page app can be built this way too: the built module's default export works as `(host, ctx)`.

## Start

```
node packages/create-helenite/bin.mjs <dir> --template app-vite [--framework preact] --name "My App"
cd <dir> && npm install && npm run build     # npm run watch keeps rebuilding
```

Frameworks available are the folders under `packages/create-helenite/templates/app-vite/adapters/` (`preact` default, `vanilla`). The CLI lists them when `--framework` is wrong. Choose Preact unless the user names another; it has the React API you know.

## The layout

```
app.md, package.json, vite.config.mjs, vite.adapter.mjs
src/main.jsx            export default defineApp(App)
src/App.jsx             your components
src/helenite/core.js    framework-free createNotes(api): query, cache, refresh, update (shared, do not fork)
src/helenite/index.jsx  the adapter: defineApp, useApi, usePage, useNotes, useNote
view.js, view.css       BUILD OUTPUT. Never edit; run the build.
```

Edit `src/`, build, then `app_reload` (the host also reloads open views when `view.js` changes). Narrow `vault.read` in `app.md` to the folders the app needs, and add `vault.write` only if it edits notes.

## Reading notes

`useNotes({ from, where, filter, sort, limit })` returns `{ notes, loading, error, refresh }`. Each note is `{ path, basename, mtime, fm }` (`fm` is the frontmatter).

- `from` is a glob or a list of globs; `where` is frontmatter equality and is sent to the host. `filter`, `sort`, `limit` run in the app.
- `useNote(path)` returns `{ note, body, loading, error, update(patch) }`. `update` patches frontmatter (`null` deletes a key) through `api.notes.update` and reloads every query.
- Data is not live: there is no vault change event. Call `refresh()` (a Refresh button) or rely on the reload after `update`.
- Pure logic (dates, parsing, stats) goes in plain `.js` modules next to the components and is imported; keep components thin.

## Rules

- Style with the theme's CSS variables in `src/*.css` (bundled into `view.css`); reuse existing class names when matching an existing look.
- `@helenite/ui-kit` is imperative DOM and does not drop into JSX. Write small components that emit its class names, or mount a kit part into a `ref` in an effect.
- Page-style apps get `usePage()` (`go`, `params`, `onParams`, `onHide`, `setStatus`, `store`); it is null when mounted as an app. Deep links stay read-only (see helenite-apps).
- Open links with `api.workspace.openNote` / `openUrl`, never `<a href>` navigation (use a click handler that prevents default).
- Test components in jsdom like `plugins/core-build/test/app-vite.test.ts`: build, import `view.js`, mount into a div with a fake `api`.

## Adding a framework

A framework is an adapter folder `templates/app-vite/adapters/<name>/` with: `package.json` (its dependencies, merged into the app's), `vite.adapter.mjs` (default export with `entry` and the framework's transform options; the shared `vite.config.mjs` spreads it), `src/main.*` (`export default defineApp(Root)`), `src/helenite/index.*` exporting `defineApp(root)` and the data bindings in that framework's idiom, built on `core.js` (`createNotes(api).query(spec)` gives `{ get, subscribe, refresh }`). `defineApp` must return `mount(root, second)` where `second` is the api for an app and `{ api, go, params, ... }` for a page, and the mount must return a cleanup that removes everything it drew. Add a row to `FRAMEWORKS` in `plugins/core-build/test/app-vite.test.ts`; the same tests run against every adapter.

## Before telling the user it is done

Build, `app_open`, look at it with real notes, click each control, and check an empty vault state and an error state. Report what you saw.
