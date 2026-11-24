# helenite-extras

The Helenite design system (`packages/ui`, `ui-kit`, `types`, `base-theme`), SDK (`create-helenite`, `connectors`), agent skills (`helenite-cc`), docs, and the catalog of plugins, themes and apps that Helenite installs from.

The Helenite app mounts this repository as a git submodule at `extras/`. It also builds on its own:

```
pnpm install
pnpm build        # base CSS, the catalog plugins' dist/
pnpm typecheck
pnpm test         # package tests, plus node --test test/ for the catalog
```

Tests that load the real plugin API (the catalog plugins' `plugin.test.ts`, the connectors' settings tabs) need the app's runtime. They run from the app (`pnpm test` there) and are skipped in a standalone clone. `packages/types/helenite.d.ts` is generated from the app's `helenite` module and committed; the app regenerates it with `pnpm --filter @helenite/types build`.

## What is here

| Path | What |
| --- | --- |
| `packages/ui`, `ui-kit`, `base-theme`, `types` | The design system: the `helenite` module's parts, the vault-app kit, the CSS, the plugin types |
| `packages/create-helenite`, `connectors` | The SDK: the scaffolder and the connector SDK with the first-party connectors |
| `packages/helenite-cc` | The Claude Code plugin with Helenite's skills |
| `docs/dev`, `docs/design-system` | The developer guide and the design-system reference |
| `catalog/plugins/*` | Plugins that ship from here |
| `templates/movie-tv` | A vault template; its `Apps/Media` is a catalog app |
| `catalog.json` | What the plugin browser lists |

## The catalog

`catalog.json` is `{ "version": 1, "entries": [...] }`. Each entry has:

| Field | |
| --- | --- |
| `id` | `^[a-z0-9][a-z0-9-]*$`; for a plugin, its manifest id |
| `name`, `description`, `author` | Shown in the browser |
| `kind` | `plugin`, `theme`, `app` or `design-system` |
| `path` and `files` | An item in this repository: a folder under `catalog/` or `templates/` and the files in it to install (relative, no `..`) |
| `repo` | Or an item in another GitHub repository (`owner/name`): installed as an Obsidian-style release (plugin) or theme repository |

Exactly one of `path` and `repo`. The app reads `catalog.json` at the latest release tag and drops any entry that breaks these rules (`scripts/catalog.mjs` is the reference; `node --test test/` checks the real file). The browser shows extras and Obsidian side by side and the extras entry wins on the same id. Design systems are not installed from the browser yet (they are used through `create-helenite --design-system`).

## Releasing

```
node scripts/release.mjs v0.2.0
git push --follow-tags
gh release create v0.2.0
```

`release.mjs` builds each `catalog/plugins/<dir>` into its `dist/`, points that plugin's entry at the `dist` folder with the files written, validates the catalog, commits (dist is git-ignored, so it is added by force) and tags. The release tag is what the app installs from, so push the tag and publish the release before expecting the browser to see it.
