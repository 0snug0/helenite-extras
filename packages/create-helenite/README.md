# create-helenite

Scaffolds a Helenite plugin, theme, vault app or multi-page vault app. Private: it is not on npm, so run it from a Helenite checkout.

```
node packages/create-helenite/bin.mjs <dir> --template plugin|theme|app|app-pages [--name "My thing"] [--id my-thing]
```

| Template | Writes |
| --- | --- |
| `plugin` | `manifest.json` (with a `helenite` range), `src/main.ts` (a command, a ribbon icon opening a `ui.form`, a settings tab with a section, a toggle and a sub-page holding a `ui.table`), `src/settings.ts`, a vitest test, `build.mjs` (esbuild; `obsidian` and `helenite` external), `tsconfig.json`, and `types/helenite.d.ts` (the `@helenite/types` file, built fresh from this checkout). |
| `theme` | `manifest.json` and `theme.css`: Obsidian and `--hel-*` variables for light and dark, and the public classes. |
| `app` | `app.md` (`theme: inherit`), `view.js` using `@helenite/ui-kit`, `view.css`, and `ui-kit.js` (the kit, bundled from this checkout). |
| `app-pages` | A vault app with pages: `app.md` (one optional secret declared, no `required`), `view.js` (the page list), `view.css` (spacing tokens), `pages/home` and `pages/about` (`ctx.go`, `ctx.params`, `ctx.onParams`, a setup state), `ui-kit.js`, and `router.js` plus `shell.js`, copied at scaffold time from `templates/movie-tv/Apps/Media` (the one source of the shell; do not edit the copies). |

It refuses a folder that is not empty and an invalid id or name, and prints the next steps. `--id` defaults to the name in lowercase with hyphens, or to the folder's name.

Templates are in `templates/<template>/`. `{{id}}` and (plugin) `{{helenite}}` are filled in, and the name as `{{name}}` (prose and line comments only), `{{nameJs}}` (a JS/TS string literal), `{{nameJson}}` (a JSON string), `{{nameYaml}}` (a YAML double-quoted scalar) and `{{nameCss}}` (inside a CSS comment). Names may hold quotes, backslashes and any Unicode, but no slash, line break or control character, and may not start with a dot; `gitignore` is renamed to `.gitignore` (npm pack drops files named `.gitignore`).

`pnpm pack` runs `vendor.mjs` first, which saves the types, the ui-kit bundle and the shell files in `vendor/`, so the tarball also works away from a checkout.

Guide: [docs/dev](../../docs/dev/README.md). Tests: `plugins/core-build/test/create-helenite.test.ts`.
