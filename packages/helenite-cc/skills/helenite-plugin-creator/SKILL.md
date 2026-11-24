---
name: helenite-plugin-creator
description: Turn a one-line plugin idea into a built Helenite plugin. Drafts a brief from the prompt, asks a short wizard only for what is unclear (who it is for, scope, surfaces, settings), designs the settings page from the design system, then builds and checks it. Use when the user asks to create, make or build a plugin, including Obsidian-style ones like a dataviewjs-like query plugin.
---

# Creating a Helenite plugin

You take a prompt like "make a dataviewjs-like plugin" to a working plugin in four steps: **brief, wizard, design, build**. Load `helenite-plugins` too; it has the API. This skill decides *what* to build and *how carefully*.

## 1. Draft the brief (no questions yet)

From the prompt, the `[Helenite]` context line and `helenite_context`, fill in every row you can. Mark each row **known** (the prompt says it, or there is one sensible answer) or **unclear**.

| Row | Choices |
| --- | --- |
| Audience | **Just me** or **Shareable** (see below) |
| Kind | Plugin; or something lighter: an Apps launcher entry (`apps_add_entry`) for "quick access to X", a vault app for sandboxed UI in one vault (`helenite-apps`) |
| Scope | **This vault** (`<vault>/.helenite/plugins/<id>/`), **Home** (all vaults), or **Home with per-vault settings** |
| Account | None, uses an existing account (`app.accounts.call`), or adds an account type (`accounts.js`, see `catalog/plugins/sample-letterboxd-account/README.md`) |
| Surfaces | Code block (`registerMarkdownCodeBlockProcessor`), post processor (inline syntax), sidebar view, command, ribbon icon, status bar item, settings tab, modal |
| Settings | Grouped list of settings with type and default (step 3) |
| Permissions | `fs:vault`, `net:<host>`, `shell`, `agent:tools`, or none |
| Form | Single `main.js` or a TypeScript project |

Defaults that are usually **known**, so do not ask:
- No external service mentioned → Account: none. A query/render/editor plugin (dataviewjs-like, kanban, calendar) never needs the accounts feature.
- Tied to this vault's notes, folders or apps → Scope: this vault. A generic capability → Home.
- Rendering a fenced block → Surface: code block, plus a settings tab if it has options.
- Settings: always propose them yourself from what the plugin does and what similar Obsidian plugins expose. The user edits; they do not write the list.

Record the brief in the session note: `summary_update_section {section: 'Plan'}`.

## 2. The wizard: ask only the unclear rows

If **every** row is known, skip to step 3 and say what you assumed in one line. Otherwise call `mcp__helenite__wizard` once, with one step per unclear row, in this order. Put your inferred answer first with `recommended: true`, and a one-line `context` that says what the plugin is (the wizard opens as its own tab).

**Audience** is asked whenever the prompt does not say. It sets how much care the build gets:

| | Just me | Shareable |
| --- | --- | --- |
| Form | single `main.js` via `plugin_scaffold` | TypeScript project: `node packages/create-helenite/bin.mjs <dir> --template plugin` (needs a helenite-extras checkout, or `extras/` in the app), then `npm install && npm run build` and copy `dist/` into the plugins folder |
| Edge cases | happy path; fail with a `ui.notice`, not a crash | empty vault, missing files, bad input, huge vaults, unload mid-render, mobile/narrow panes |
| Manifest | id, name, version, minAppVersion | plus `description`, `author`, a `helenite` range, `permissions` declared honestly |
| Settings | defaults hard-wired where nobody would change them | every option the user could reasonably want, each with a description; a reset row |
| Obsidian | Helenite only, `import { ui } from 'helenite'` | ask in the wizard whether it should also run in Obsidian; if yes, guard `require('helenite')` in a `try` |
| Done means | it renders and `plugin_logs` is clean | plus a test, a README (install, settings, syntax), version bumped, `docs/dev/publishing.md` checklist |

Example wizard for "make a dataviewjs-like plugin" where audience and settings depth are unclear but scope and account are known:

```json
{
  "title": "New plugin: JS query blocks",
  "context": "A dataviewjs-like plugin: fenced js blocks that query this vault's notes and render tables and lists. No account needed; it will live in this vault.",
  "steps": [
    { "id": "audience", "title": "Who is it for?", "fields": [
      { "type": "choice", "id": "audience", "label": "Who will use it?", "options": [
        { "label": "Just me", "description": "Quick build, happy path, Helenite only.", "recommended": true },
        { "label": "Shareable", "description": "Edge cases, README, test, permissions, publishable folder." } ] } ] },
    { "id": "settings", "title": "Settings", "fields": [
      { "type": "info", "id": "proposal", "label": "Proposed settings", "text": "General: code block language (helenite-js), enable inline queries\nRendering: date format, empty-value text, show result count\nRefresh: auto-refresh on file change, refresh delay (ms)" },
      { "type": "choice", "id": "keep", "label": "Which groups to build?", "multi": true, "options": ["General", "Rendering", "Refresh"] },
      { "type": "text", "id": "extra", "label": "Anything to add or change?", "multiline": true } ] }
  ]
}
```

Field types are `choice` (with `options`, `multi`), `text` (`multiline`), `confirm` and `info` (`text`, read-only). For a single unclear row with context worth showing, `mcp__helenite__ask` with option `preview`s is lighter than a wizard. Never list options in prose.

Write the answers into the brief (`summary_update_section {section: 'Decisions'}`).

## 3. Design the settings page

Turn the settings list into a page plan before writing code, using the mapping in [settings-ui.md](settings-ui.md). The plan is a short outline: sections, each row with its part, key, type and default. For more than about eight settings, or for lists of records, push detail into `ui.settings.subpageRow` pages rather than one long page. Show the outline in the session note (`Plan`); do not ask for approval unless the user wanted to review it.

If Scope is **Home with per-vault settings**, tag each key in `manifest.json` under `helenite.settings` (`global`, `overridable` or `vault`) and say which in the outline.

## 4. Build and check

1. Create it: `plugin_scaffold {id, name, scope, template}` (template from the main surface: `sidebar-view`, `ribbon-action`, `command` or `settings-tab`; use `settings-tab` for a code-block plugin and add the processor), or the TypeScript template for Shareable (rebuild and copy `dist/` after each change; Helenite hot-reloads when `main.js` changes).
2. Write settings first: a `DEFAULTS` object, `Object.assign({}, DEFAULTS, await this.loadData())`, `saveData` on change, and the settings tab from the outline. Then the core feature.
3. `plugin_reload {id}`. If it says `no such plugin`, the folder is new and Helenite reads plugin folders at startup: ask the user to restart Helenite, then reload. Read `plugin_logs {id}` after every reload.
4. Check it like a user: for a code-block plugin, write a sample note with a few blocks, `workspace_open` it, `note_render_check` it; open the settings tab; `view_screenshot` both. Fix and repeat until the screenshots look right in the theme.
5. For **Shareable**, work through its column in the table above before calling it done.

Report what was built, where it lives, the sample note's path, and anything left out on purpose (for Just me, the edge cases you skipped).

A worked example for a dataviewjs-like plugin is in [example-js-query.md](example-js-query.md).
