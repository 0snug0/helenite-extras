# {{name}}

A Helenite plugin, made by create-helenite. It has a command ("Say hello"), a ribbon icon that opens a form, and a settings tab with a section, a toggle and a sub-page that holds a table.

The full guide is `docs/dev/plugins.md` in the Helenite repository.

## Files

| File | What it is |
| --- | --- |
| `manifest.json` | The plugin manifest. `helenite` is the range of Helenite versions it works with. |
| `src/main.ts` | The plugin. |
| `src/settings.ts` | The saved data and its defaults, kept apart so the test can run without the app. |
| `test/settings.test.ts` | A unit test (vitest). |
| `styles.css` | Your CSS, copied into `dist/` by the build. Prefer the design-system parts to your own CSS. |
| `types/helenite.d.ts` | The types of the `helenite` module (`@helenite/types`). |
| `build.mjs` | Bundles `src/main.ts` into `dist/main.js` with esbuild. |

## Commands

```sh
npm install
npm run build      # dist/main.js, dist/manifest.json, dist/styles.css
npm run typecheck
npm test
```

## Install it

Copy `dist/` into a plugins folder and restart Helenite:

- Home (available to every vault): `~/.helenite/.obsidian/plugins/{{id}}/`
- One vault only: `<vault>/.helenite/plugins/{{id}}/`

Then turn it on in Settings, Community plugins. Helenite reloads an enabled plugin by itself when its `main.js`, `manifest.json` or `styles.css` changes, so after that, copying a new build is enough.

## The `helenite` types

`@helenite/types` is private to the Helenite repository and not on npm, so create-helenite copied its file into `types/helenite.d.ts`. To update it, build it in your Helenite checkout and copy it over:

```sh
pnpm --filter @helenite/types build
cp <helenite>/packages/types/dist/helenite.d.ts types/helenite.d.ts
```

## Run in Obsidian too

`import { ui } from 'helenite'` fails in Obsidian, which has no such module. To support both apps, require it in a `try` and fall back to Obsidian's own UI:

```ts
import { Notice } from 'obsidian';

let hel: typeof import('helenite') | undefined;
try { hel = require('helenite'); } catch {}

if (hel) hel.ui.notice('Saved', { kind: 'success' });
else new Notice('Saved');
```
