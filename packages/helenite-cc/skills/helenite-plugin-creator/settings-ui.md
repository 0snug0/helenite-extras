# Settings: from a list to a page

Draw plugin settings with `ui.settings` parts and Obsidian's `Setting` (`ui.settings.row` is the same class) so the page matches Helenite's own. Full options: `docs/design-system/README.md#uisettings`; live examples: Settings, **Design system** in Home.

## Page structure

A sketch; the plugin holds `settings` and an `update(patch)` that merges and saves.

```ts
import { PluginSettingTab, Setting } from 'obsidian';
import { ui } from 'helenite';

class Tab extends PluginSettingTab {
  constructor(app, plugin) { super(app, plugin); this.plugin = plugin; }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    const general = ui.settings.section(containerEl, 'General');
    new Setting(general).setName('Enable inline queries').setDesc('Run `= …` spans in reading view.')
      .addToggle((t) => t.setValue(this.plugin.settings.inline).onChange((v) => this.plugin.update({ inline: v })));
  }
}

// in the Plugin:
// async update(patch) { Object.assign(this.settings, patch); await this.saveData(this.settings); }
```

One `section` per group in the outline. Sentence-case names; every row gets a `setDesc` unless the name says it all.

## Which control for which setting

| Setting is | Row |
| --- | --- |
| On / off | `new Setting(sec).addToggle(...)` |
| Short text (prefix, language name, folder) | `.addText(...)`; folder or file paths: `.addSearch(...)` if you add a suggester |
| Long text (template, CSS, JS snippet) | `.addTextArea(...)`, or a `subpageRow` whose page has `ui.textInput(page, { multiline: true, rows: 8 })` |
| Number in a range | `.addSlider(...)` with `setDynamicTooltip()`; free number: `.addText` + `inputEl.type = 'number'`, validated |
| One of a few (2-4) | `.addDropdown(...)`; on a sub-page, `ui.segmented` |
| One of many | `.addDropdown(...)` |
| Several on/off from a list | `subpageRow` → `ui.checkList` |
| A list of records (saved queries, rules, mappings) | `subpageRow` whose page has `ui.table` with `ui.action(…, 'add')` above and `ui.action(…, 'delete', { app, subject, onClick })` per row; edit a record with `ui.form` |
| A secret (API key) | `.addText` with `inputEl.type = 'password'`; Shareable plugins that talk to a service should use an account type instead |
| Which vaults get a feature (Home plugin) | `ui.settings.vaultScope` in a `ui.settings.card` |
| Home default vs this vault (per-vault settings) | `ui.settings.scopeBar` at the top, plus `helenite.settings` tags in the manifest |
| A status or summary that opens detail | `ui.settings.summaryRow(sec, { name, desc, onClick, chevron: true })` |
| A destructive action (clear cache, reset) | `.addButton` → `ui.confirm(app, { …, danger: true })`; a reset row at the bottom for Shareable |
| Help or a warning about a group | `ui.callout` at the top of the section |

## Rules

- Save on change (`onChange` → `saveData`), no Save button. Re-render dependent rows by calling `this.display()` only when a toggle shows or hides rows.
- A `ui.*` input on a sub-page goes in a `ui.field` (or gets a `label`) so it has a name.
- Validate with a visible message (`ui.field(...).setError`) instead of silently ignoring bad input.
- Keep the main page short: around eight rows. Advanced or list-shaped settings go on `subpageRow` pages.
- Style with theme variables (`var(--text-muted)`), never hard-coded colours.
- A modal's title is a verb phrase and its button repeats the verb; never "OK".
