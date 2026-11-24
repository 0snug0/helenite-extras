# Plugins

A Helenite plugin is an Obsidian plugin. It extends `Plugin` from `obsidian`, has the same lifecycle, and ships as the same folder: `manifest.json`, `main.js` and an optional `styles.css`. Helenite implements the Obsidian API itself (`packages/obsidian-api`), so the `obsidian` module your bundle requires at run time is Helenite's. Helenite adds a second module, `helenite`, with its design-system parts.

The quickest start is the template: `node packages/create-helenite/bin.mjs my-plugin --template plugin` ([getting-started.md](./getting-started.md)).

## Where plugins live

| Folder | Scope |
| --- | --- |
| `<Home>/.obsidian/plugins/<id>/` | Home's plugins. Home is `~/.helenite`. Every vault can use them, and Home decides where each is on. |
| `<vault>/.helenite/plugins/<id>/` | One vault's own copy. In that vault it wins over a Home plugin with the same id. |
| `plugins/core-*` in the repository | Core plugins, shipped with Helenite. |

Turn a plugin on in Settings, **Community plugins**. In Home, the **Installed in Home** table has a **Home** column (on or off in Home) and a **Vaults** column (which vaults get it, and whether it starts on there). In a vault, the same tab shows each plugin's state in that vault.

Helenite reads the plugin folders at startup, so a new folder needs a restart. After that, an enabled plugin reloads by itself when its `main.js`, `manifest.json` or `styles.css` changes.

## Lifecycle

Each open vault has its own window content and its own `app`, as in Obsidian. A Home plugin that is on in three vaults therefore runs three times, once per vault, each with that vault's `this.app`. Use `onload` and `onunload` as in Obsidian, and register what you add (`this.registerEvent`, `this.register`, `this.addCommand`, `this.registerView`) so that turning the plugin off, or a hot reload, removes it.

Loading a plugin evaluates `main.js` as CommonJS with a `require` that serves `obsidian`, `helenite`, `moment`, the CodeMirror and Lezer packages Obsidian shares with plugins (one copy, the host's; the list is in `apps/desktop/src/renderer/host-require.ts`), and Node's and Electron's modules. Bundle everything else, and keep those external. The template's `build.mjs` does this with esbuild, as does `plugins/core-build/build.mjs` for the plugins in this repository.

## The manifest

```json
{
  "id": "my-plugin",
  "name": "My Plugin",
  "version": "0.1.0",
  "minAppVersion": "1.4.0",
  "description": "What it does.",
  "author": "You",
  "isDesktopOnly": false,
  "helenite": "^0.1.0"
}
```

| Key | What Helenite does with it |
| --- | --- |
| `id` | The folder name and the plugin's id. It may not contain `#` (Helenite skips such a plugin). |
| `name`, `version`, `description`, `author` | Shown in Settings. Command names are prefixed with `name`. |
| `helenite` | The Helenite versions the plugin works with (below), or an object with more Helenite settings. |
| `permissions` | Opts into Helenite's permission prompt ([below](#permissions)). |
| `minAppVersion`, `isDesktopOnly` | Kept for Obsidian. Helenite does not check them. |

### The `helenite` range

The range is either the whole value or, when `helenite` is an object, its `version`:

```json
{ "helenite": "^0.1.0" }
{ "helenite": { "version": "^0.1.0", "settings": { "*": "overridable" } } }
```

| Form | Means |
| --- | --- |
| `0.1.0` | Exactly that version. |
| `>=0.1.0` | That version or later. |
| `^1.2.0` | 1.2.0 or later, below 2.0.0. |
| `^0.1.0` | 0.1.0 or later, below 0.2.0 (for `0.y.z`, the minor must match). |

Any other form is unreadable. When the range is unreadable or not met, Helenite does not load the plugin and shows a notice saying why. Without a range, it loads on every version. The running version is `version` from `helenite` (`0.1.0` today). The check is in `packages/obsidian-api/src/helenite-range.ts`.

### `helenite.settings`: per-vault settings

A Home plugin keeps its settings in Home's `data.json`. A vault can override some of them; Helenite stores those keys in `<vault>/.helenite/plugin-settings/<id>.json` and layers them on top when the plugin calls `loadData()`. Your code calls `loadData()` and `saveData()` as usual, and Helenite routes each key.

To say which keys a vault may change, tag them:

```json
{ "helenite": { "settings": { "*": "overridable", "apiKey": "global", "lastFolder": { "scope": "vault", "label": "Last folder" } } } }
```

- `global`: one value for every vault.
- `overridable`: Home's value, unless a vault overrides it (the default for untagged keys, set with `"*"`).
- `vault`: each vault has its own.

A plugin without `helenite.settings` still works: a vault either uses Home's settings or keeps a separate copy of its own.

### `helenite.accounts`: account types

A plugin can also add an account type (a service whose accounts vaults can be allowed to use). That uses a second entry, `accounts.js`, declared under `helenite.accounts`. See `catalog/plugins/sample-letterboxd-account/README.md`.

Access is all or nothing per account and vault: a vault that Home lets use an account may call every method the type declares. Helenite enforces that with the type's `hosts`, not with capabilities:

- `hosts` is the guard. Main limits every request a method makes (including each redirect hop) to the type's `hosts`, and fills `{{secret:NAME}}` placeholders from the account's secrets.
- `capabilities` in `accountTypes` are labels only (an `id`, a `label`, a `risk` shown in Settings). They grant and refuse nothing, and methods may map to them for display.
- `http` and `paths` on a capability are ignored if present (old manifests keep loading). Requests are bounded by host, not by method or path.

## Settings tabs

Use `PluginSettingTab` as in Obsidian, and draw the page with the `ui.settings` parts so it matches Helenite's own settings:

```ts
import { Plugin, PluginSettingTab, Setting } from 'obsidian';
import { ui } from 'helenite';

class MySettingTab extends PluginSettingTab {
  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    const general = ui.settings.section(containerEl, 'General');      // a heading and a container for its rows
    new Setting(general).setName('Sync').addToggle((t) => t.setValue(true));  // Obsidian's Setting; ui.settings.row is the same class
    ui.settings.subpageRow(this.app, general, {                        // a row that opens a page with a Back button
      name: 'Items', desc: '3 items', title: 'Items',
      render: (page) => ui.table(page, { columns: [{ key: 'name', title: 'Name', cell: (r) => r.name }], rows: items }),
    });
  }
}
```

The other settings parts are `summaryRow` (a row with a one-line summary), `openSubpage` (a sub-page without a row), `card` (a bordered card whose head is a `Setting`), `vaultScope` (which vaults may use something) and `scopeBar` (the Home / Vault Defaults switch). [design-system.md](./design-system.md) says when to use which; [the reference](../design-system/README.md#uisettings) has their options.

## Commands and the ribbon

`this.addCommand({ id: 'say-hello', name: 'Say hello', callback })` registers `<plugin id>:say-hello`, shown in the command palette as "<plugin name>: Say hello". Users can bind a hotkey to it in Settings, Hotkeys.

`this.addRibbonIcon(icon, title, callback)` adds a button to the left rail. Helenite's rail groups icons: Home plugins' icons at the top, and the icons of plugins on only in this vault (a vault's own copy, or one turned on here while off by default) next to the vault's circle.

## Data

`loadData()` and `saveData()` read and write the plugin's `data.json`, with the vault layering above for Home plugins. `loadData()` resolves to `null` on the first run, so merge it with your defaults (the template's `src/settings.ts` shows one way). A vault's own copy of a plugin keeps its `data.json` in its own folder.

## Permissions

Helenite sorts plugins by what their manifest says:

- **Core plugins** ship with Helenite and are trusted.
- **Plugins that declare `permissions`** are Helenite plugins. When the user turns one on, Helenite lists what it asks for and asks to allow it, and asks again whenever the list changes. The permissions are `fs:vault` (read and write files in this vault), `net:<host>` (connect to a host, `*.example.com` or `*` allowed), `shell` (run commands) and `agent:tools` (register and call tools for the AI agent). An unknown or malformed entry stops the plugin from loading.
- **Plugins without `permissions`** are treated as Obsidian community plugins: they run with full access, and turning one on shows a warning ("Enable My Plugin?", with **Enable anyway**) once per version.

```json
{ "permissions": ["fs:vault", "net:api.example.com"] }
```

What was granted is kept as a guard (`app.plugins.getPermissionGuard(id)`, with `checkNet(url)` and `require(permission)`). Helenite does not yet route every plugin API through the guard, so treat `permissions` as an honest declaration the user approves, not as a sandbox. Vault apps are the sandboxed option ([vault-apps.md](./vault-apps.md)). The code is in `packages/plugin-permissions`.

## Running in Obsidian too

`helenite` exists only in Helenite. A static `import { ui } from 'helenite'` makes the plugin Helenite-only: in Obsidian, loading it throws. To support both, require it in a `try` and fall back to Obsidian's UI:

```ts
import { Notice } from 'obsidian';

let hel: typeof import('helenite') | undefined;
try { hel = require('helenite'); } catch {}

if (hel) hel.ui.notice('Saved', { kind: 'success' });
else new Notice('Saved');
```

`typeof import('helenite')` is only a type, so it adds nothing to the bundle. Keep `helenite` external in your bundler either way. Give the plugin a `helenite` range so an older Helenite refuses it with a clear notice instead of failing later.
