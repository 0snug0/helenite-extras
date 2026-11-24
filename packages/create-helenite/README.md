# create-helenite

Scaffolds a Helenite plugin, theme, vault app or multi-page vault app. Private: it is not on npm, so run it from a helenite-extras checkout (or `extras/` in the app).

```
node packages/create-helenite/bin.mjs <dir> --template plugin|theme|app|app-pages|app-vite [--name "My thing"] [--id my-thing] [--framework preact] [--style tailwind] [--design-system modern]
```

| Template | Writes |
| --- | --- |
| `plugin` | `manifest.json` (with a `helenite` range), `src/main.ts` (a command, a ribbon icon opening a `ui.form`, a settings tab with a section, a toggle and a sub-page holding a `ui.table`), `src/settings.ts`, a vitest test, `build.mjs` (esbuild; `obsidian` and `helenite` external), `tsconfig.json`, and `types/helenite.d.ts` (the `@helenite/types` file, built fresh from this checkout). |
| `theme` | `manifest.json` and `theme.css`: Obsidian and `--hel-*` variables for light and dark, and the public classes. |
| `app` | `app.md` (`theme: inherit`), `view.js` using `@helenite/ui-kit`, `view.css`, and `ui-kit.js` (the kit, bundled from this checkout). |
| `app-pages` | A vault app with pages: `app.md` (one optional secret declared, no `required`), `view.js` (the page list), `view.css` (spacing tokens), `pages/home` and `pages/about` (`ctx.go`, `ctx.params`, `ctx.onParams`, a setup state), `ui-kit.js`, and `router.js` plus `shell.js`, copied at scaffold time from `templates/movie-tv/Apps/Media` (the one source of the shell; do not edit the copies). |
| `app-vite` | Spike. A vault app written with a framework and built by Vite into plain `view.js` and `view.css` beside `app.md` (the sandbox, manifest and permissions are unchanged). `--framework preact` (default) or `vanilla`; a framework is an adapter folder under `templates/app-vite/adapters/<name>` (`vite.adapter.mjs`, `src/main.*`, `src/helenite/` with `defineApp` and the data bindings) over the shared `base/` (manifest, `vite.config.mjs`, and `src/helenite/core.js`, the framework-free `createNotes(api)` query/cache/update layer). Preact's `useNotes({ from, where, filter, sort, limit })` and `useNote(path)` read the user's markdown notes through `api.notes`. Build with `npm install && npm run build`. Two more pluggable layers sit over the adapter, chosen by `--style` (a CSS framework: `tailwind`, mapped to the theme's variables with no preflight) and `--design-system` (components and tokens: `modern`, with Button, Card, Badge, Input, Tabs, Stat, List and EmptyState for Preact and vanilla); both default to `none`. Every `app-vite` app is responsive by default: `.app` is a size container, `.app-grid` and the design system's `Grid` reflow into as many columns as fit, and narrow panes tighten spacing and scroll tabs. `node packages/create-helenite/bin.mjs --list` shows what exists. |

It refuses a folder that is not empty and an invalid id or name, and prints the next steps. `--id` defaults to the name in lowercase with hyphens, or to the folder's name.

Templates are in `templates/<template>/`. `{{id}}` and (plugin) `{{helenite}}` are filled in, and the name as `{{name}}` (prose and line comments only), `{{nameJs}}` (a JS/TS string literal), `{{nameJson}}` (a JSON string), `{{nameYaml}}` (a YAML double-quoted scalar) and `{{nameCss}}` (inside a CSS comment). Names may hold quotes, backslashes and any Unicode, but no slash, line break or control character, and may not start with a dot; `gitignore` is renamed to `.gitignore` (npm pack drops files named `.gitignore`).

`pnpm pack` runs `vendor.mjs` first, which saves the types, the ui-kit bundle and the shell files in `vendor/`, so the tarball also works away from a checkout.

Guide: [docs/dev](../../docs/dev/README.md). Tests: `plugins/core-build/test/create-helenite.test.ts`.

## Adding a CSS framework or design system

A layer is a folder under `templates/app-vite/styles/<name>/` (CSS framework) or `templates/app-vite/design-systems/<name>/`, or any folder passed by path (`--design-system ./my-ds`). It holds `layer.json` (`{ name, description, frameworks?, cssImports? }`), `files/` (copied over the project; its `package.json` dependencies merge in), and optionally `frameworks/<adapter>/` (copied for that adapter only, so a design system can ship its components per framework and a starter `App`). `cssImports` (paths under `src/`) become `@import` lines at the top of `src/style.css`. A style layer may replace `vite.style.mjs` (`{ plugins, css }`, merged into the Vite config). Layers apply in order: base, adapter, style, design system. Put design-system CSS in `@layer components` so utilities and the app's own CSS win. Adding a layer needs no change to the scaffolder; add a row to `COMBOS` in `plugins/core-build/test/app-vite.test.ts` to cover it.
