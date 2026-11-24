# Hello world in 5 minutes

This page takes you from nothing to a working Helenite plugin: scaffold it, build it, put it in a scratch Helenite and turn it on. It assumes you know how Obsidian plugins work.

The `sh` blocks on this page are run, in order, by the app's `plugins/core-build/test/create-helenite.test.ts`, so they stay correct. (The test starts no app: it loads the plugin into the test harness instead, and links `npm install`'s packages from the repository instead of downloading them.)

## Before you start

You need Node 22 or later, npm, and a Helenite app checkout (cloned with `--recursive`, so `extras/` holds this repository) where `pnpm install` has run. To run the dev build, Electron needs its binary (`node node_modules/electron/install.js` in `apps/desktop` if `electron` says it is missing); in a fresh checkout, also build the terminal helpers once: `node packages/pty-host/scripts/build.mjs` and `node packages/agent-bridge/scripts/build.mjs`.

Run everything below in one terminal, starting at the root of the app checkout. The commands name the scaffolder as `packages/create-helenite/bin.mjs`, its path inside this repository; from the app root that is `extras/packages/create-helenite/bin.mjs`, so add the `extras/` prefix there.

## 1. Scaffold the plugin

```sh
HELENITE=$PWD
node packages/create-helenite/bin.mjs ~/hello-helenite --template plugin --name "Hello Helenite"
```

This writes `~/hello-helenite` with a manifest, `src/main.ts`, a test, a build script and `types/helenite.d.ts` (the types of the `helenite` module, built from this checkout). The plugin's id, `hello-helenite`, is made from the name; pass `--id` to choose another. create-helenite refuses a folder that is not empty.

## 2. Build and test it

```sh
cd ~/hello-helenite
npm install
npm run build
npm run typecheck
npm test
```

`npm run build` writes `dist/main.js`, `dist/manifest.json` and `dist/styles.css`. `dist/` is the whole plugin.

## 3. Start a scratch Helenite

```sh
pnpm --dir "$HELENITE/apps/desktop" start --user-data="$HOME/.helenite-dev"
```

This is the dev build. It runs on throwaway copies of the repository's fixture vaults in `apps/desktop/.dev-vaults`, with Home at `apps/desktop/.dev-vaults/home`, and keeps its app data in `~/.helenite-dev`. Your real Home (`~/.helenite`) and vaults are not touched. It makes `.dev-vaults` the first time; quit it once the window is up.

## 4. Install the plugin into Home

```sh
PLUGIN_DIR="$HELENITE/apps/desktop/.dev-vaults/home/.obsidian/plugins/hello-helenite"
mkdir -p "$PLUGIN_DIR"
cp dist/* "$PLUGIN_DIR/"
```

Home's plugins live in `<Home>/.obsidian/plugins/<id>/`, and every vault can use them. A plugin for one vault only goes in `<vault>/.helenite/plugins/<id>/`.

## 5. Turn it on

```sh
pnpm --dir "$HELENITE/apps/desktop" start --user-data="$HOME/.helenite-dev"
```

In the Home window:

1. Open Settings (`Cmd+,`), then **Community plugins**. "Hello Helenite" is under **Installed in Home**. Switch it on in the **Home** column.
2. Helenite asks "Enable Hello Helenite?" and warns that it runs with full access, as it does for every plugin that declares no `permissions` (see [plugins.md](./plugins.md#permissions)). Choose **Enable anyway**.
3. Open the command palette (`Cmd+P`) and run **Hello Helenite: Say hello**. A notice says "Hello from Hello Helenite!".
4. Click the smiley icon in the left rail. A form asks for a greeting; **Add greeting** saves it.
5. Open Settings, **Hello Helenite**: a General section with a toggle and a **Greetings** row. The row opens a sub-page with a table of greetings, a Delete button per row (it asks first) and an Add button.

## 6. Change it

Edit `src/main.ts`, then rebuild and copy:

```sh
npm run build
cp dist/* "$PLUGIN_DIR/"
```

Helenite reloads an enabled plugin when its `main.js`, `manifest.json` or `styles.css` changes, so there is no restart. A new plugin folder is only found at startup.

## Next

- [plugins.md](./plugins.md): the plugin lifecycle, manifest, settings tabs, commands, data and permissions.
- [design-system.md](./design-system.md): which `ui` part to use for what.
- [testing.md](./testing.md): testing beyond the template's unit test.
- The other templates: `--template theme` ([themes.md](./themes.md)), `--template app` and `--template app-pages` (an app with a nav bar and pages); see [vault-apps.md](./vault-apps.md).
