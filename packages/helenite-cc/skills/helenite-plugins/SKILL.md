---
name: helenite-plugins
description: How to write, scope, load and debug a Helenite (Obsidian-API compatible) plugin. Use when the user wants a new sidebar view, ribbon item, command, settings tab or other UI in Helenite.
---

# Writing a Helenite plugin

Helenite implements the Obsidian plugin API (clean room). A plugin is a folder with `manifest.json` (`id`, `name`, `version`, `minAppVersion`) and `main.js` (CommonJS, `require('obsidian')`).

**Scope.** Vault plugins live in `<vault>/<configDir>/plugins/<id>/` (`.helenite` for vaults, `.obsidian` for Home) and apply to that vault only. Global plugins apply everywhere. Rule: anything tied to this vault's own notes or apps is a vault plugin; generic capabilities are global; when unclear, ask the user with a choice question.

**Prefer the launcher.** "Give me quick access to X" is usually an entry in the Apps view: `apps_add_entry`, not a new plugin. Write a plugin only for genuinely new UI.

**Workflow.**
1. `plugin_scaffold {id, scope, template}` with template `sidebar-view`, `ribbon-action`, `command` or `settings-tab`.
2. Edit `main.js` (read it first; the scaffold is a working starting point).
3. `plugin_reload {id}`; check `plugin_logs {id}` for errors.
4. `view_screenshot` to see the result; fix and reload until it looks right.

**A plugin as a project** (TypeScript, a build, tests), in a Helenite checkout: `node packages/create-helenite/bin.mjs <dir> --template plugin` writes one (manifest with a `"helenite": "^0.1.0"` range, `src/main.ts` with a command, ribbon form and settings tab, a test, `types/helenite.d.ts`), then `npm install && npm run build` and copy `dist/` into the plugins folder. Guide: `docs/dev/getting-started.md` and `docs/dev/plugins.md`.

**UI.** Use the `helenite` module's parts (`import { ui } from 'helenite'`: `ui.button`, `ui.table`, `ui.form`, `ui.settings.section`/`subpageRow`, `ui.notice`, ...) rather than hand-built DOM; `docs/dev/design-system.md` says which part fits, `docs/design-system/README.md` has every option. A plugin that must also run in Obsidian wraps `require('helenite')` in a `try`.

**API essentials.** `class X extends Plugin { async onload() {…} onunload() {…} }`; `this.addCommand`, `this.addRibbonIcon`, `this.registerView`, `this.addSettingTab`, `this.loadData()/saveData()`, `this.registerEvent(app.workspace.on(...))`, `this.app.vault.read/modify/getMarkdownFiles`, `this.app.metadataCache.getFileCache(file)`, `ItemView`, `Modal`, `Notice`, `Setting`. Style with theme CSS variables (`var(--background-primary)`, `var(--text-normal)`), never hard-coded colours. Clean up everything in `onunload` (use `register*` helpers).
