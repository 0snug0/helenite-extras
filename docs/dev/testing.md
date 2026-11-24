# Testing

Three levels, from cheapest to fullest: unit tests of your own modules, the plugin harness (your built plugin loaded into a real Helenite `App` under jsdom), and screenshots of the running app.

## Unit tests

Keep logic that does not need the app in modules that import neither `obsidian` nor `helenite`, and test them with vitest. The plugin template does this: `src/settings.ts` holds the defaults and their merge, and `test/settings.test.ts` tests it with `npm test`.

When a module does import them, mock them. `catalog/plugins/sample-letterboxd-account/test/vault-feature.test.ts` stands in for `PluginSettingTab` and `ui.notice`:

```ts
vi.mock('obsidian', async (orig) => ({ ...(await orig<object>()), PluginSettingTab: class { constructor(public app: unknown, public plugin: unknown) {} } }));
vi.mock('helenite', () => ({ ui: { notice: (msg: string) => void notices.push(msg) } }));
```

That sample resolves `obsidian` and `helenite` to Helenite's own sources in its `vitest.config.ts` (`resolve.alias`), which only works inside the repository.

## Typechecking against @helenite/types

`@helenite/types` is generated from the runtime `helenite` module (`node packages/types/build.mjs`, or `pnpm --filter @helenite/types build`), so it cannot drift from what Helenite provides. It writes `packages/types/helenite.d.ts`.

- **A scaffolded plugin** has a copy in `types/helenite.d.ts`, included by its `tsconfig.json`. `npm run typecheck` runs `tsc --noEmit -p .`. To pick up a newer Helenite, build the types in your checkout and copy the file over.
- **A plugin in this repository** maps the module in its `tsconfig.json`, as `catalog/plugins/sample-design-system` does: `"paths": { "helenite": ["../../packages/types/helenite.d.ts"] }`, with a `typecheck` script that builds the types first.

`pnpm -s typecheck` at the root runs every package's `typecheck` script.

## The plugin harness

`plugins/core-build/test/harness.ts` runs a real Helenite `App` (the same `packages/obsidian-api` the desktop app runs) in vitest's jsdom environment, on a vault in a temp folder. It loads plugins through the real plugin loader, with `obsidian` and `helenite` served as in the app. It lives in the repository and is not packaged, so use it from a checkout.

| Helper | What it does |
| --- | --- |
| `makeApp(files?, hostModules?, seedDir?)` | A new initialised `App` on a temp vault with these files (or a copy of `seedDir`). Returns `{ app, vaultPath }`. |
| `loadBuiltPlugin(app, id)` | Copies `plugins/<id>/dist` into the vault's plugins folder (core plugins load as core) and enables it. |
| `tick(ms)` | Waits, for modals and async work to settle. |

A plugin in this repository goes in `plugins/<id>/` and builds with `node plugins/core-build/build.mjs <id>` (it writes `plugins/<id>/dist`). Its harness test goes in `plugins/core-build/test/`, like `sample-design-system.test.ts`:

```ts
import { loadBuiltPlugin, makeApp, tick } from './harness';

it('its settings tab has a section and a sub-page row', async () => {
  const { app } = await makeApp();
  const plugin: any = await loadBuiltPlugin(app, 'sample-design-system');
  const tab = (app as any).setting.pluginTabs.find((t: any) => t.plugin === plugin);
  tab.display();
  expect(tab.containerEl.querySelector('.hel-section')).toBeTruthy();
});
```

A plugin built elsewhere loads the same way: copy its `dist/` into `<vaultPath>/.obsidian/plugins/<id>/`, then call `app.plugins.loadManifests()` and `app.plugins.enablePlugin(id)`. `plugins/core-build/test/create-helenite.test.ts` does exactly that for the scaffolded template.

Useful while testing:

- Commands: `app.commands.findCommand('<id>:<command>')` and `app.commands.executeCommandById(...)`.
- Settings tabs: `app.setting.pluginTabs`, then `tab.display()` and query `tab.containerEl`. A sub-page row calls `app.setting.openSubpage(title, render)`; replace it with a function that renders into an element you hold.
- Modals and notices are added to `document.body`: `.hel-modal`, `.hel-notice`.
- Select by `data-*` hooks where a part sets them (`data-action` on dialog buttons, `data-field` on form rows), otherwise by the `hel-*` classes in [STYLING.md](../design-system/STYLING.md).

Run it with `pnpm --filter @helenite/core-build test` (it builds the core plugins first), or one file with `npx vitest run test/<file>.test.ts` in `plugins/core-build`. Build your plugin before running its test.

## Screenshots

The compatibility harness in `compat/` drives the real app (Electron) on scratch vaults with scratch user data, and diffs screenshots against baselines. It is not a workspace member; install it once with `pnpm --dir compat install`.

- A theme, in light and dark: put your theme's folder in a folder of its own, then

  ```
  pnpm --dir compat run themes -- --themes-dir=<folder holding your theme folder> --only=<theme folder name>
  ```

  The first run records the baselines (in `compat/baselines/<platform>/third-party/`, gitignored); later runs compare against them. `themes:update` records them again. Screenshots land in `compat/results/themes-out/`.
- Every Settings tab under a theme: `pnpm --dir compat run settings -- --only=none,helenite-test`, with `--tabs=<id,id>` for some tabs. Baselines are in `compat/baselines/<platform>/settings`, and `settings:update` records them.

The vault apps' own end-to-end checks (frames, CSP, theme forwarding) are in `packages/apps-runtime/e2e` and `apps/desktop`'s `pnpm --dir apps/desktop e2e`.
