# Example: a dataviewjs-like plugin

Prompt: "Create a dataviewjs-like plugin for the media vault."

## Brief after step 1

| Row | Value | Known? |
| --- | --- | --- |
| Audience | ? | unclear: ask |
| Kind | Plugin (new rendering, not a launcher entry or app) | known |
| Scope | This vault (built for the media vault's notes) | known |
| Account | None (reads only local notes) | known |
| Surfaces | Code block `helenite-js`; optional inline `$= …` post processor; settings tab | known |
| Settings | Proposed below | partly: ask which groups |
| Permissions | `fs:vault` if Shareable; none needed for Just me | follows audience |
| Form | Follows audience | follows audience |

The scope is simple even though the build is big: one vault, no account, no per-vault layering. The complexity is in the settings and the query API, which is what the wizard should spend its questions on.

## Proposed settings (what Dataview's JS side exposes, trimmed)

| Section | Setting | Key | Row | Default |
| --- | --- | --- | --- | --- |
| General | Code block language | `blockLang` | text, description says "Applies after reloading the plugin" | `helenite-js` |
| General | Enable inline JS (`$= …`) | `inline` | toggle | on |
| General | Inline prefix | `inlinePrefix` | text, shown when `inline` is on | `$=` |
| Rendering | Date format | `dateFormat` | text, validated by formatting a sample date with `require('moment')` | `YYYY-MM-DD` |
| Rendering | Text for empty values | `emptyText` | text | `—` |
| Rendering | Show result count in table headers | `showCount` | toggle | on |
| Refresh | Refresh when notes change | `autoRefresh` | toggle | on |
| Refresh | Refresh delay | `refreshMs` | slider 100-5000 | 1000 |
| Advanced (sub-page) | Saved snippets | `snippets` | `subpageRow` → `ui.table` + add/delete | `[]` |

## The API the block gets

Keep it small and Dataview-shaped so existing snippets port: `hjs.pages(folderOrTag?)` (files with `file.name`, `file.path`, `file.mtime` and frontmatter via `app.metadataCache.getFileCache`), `hjs.table(headers, rows)`, `hjs.list(items)`, `hjs.paragraph(text)`, `hjs.current()`. Render tables with `ui.table` and empty results with `ui.emptyState`, errors with `ui.errorState` showing the message. Run the block as an async function so snippets can `await`: `const AsyncFn = Object.getPrototypeOf(async function () {}).constructor; await new AsyncFn('hjs', 'app', code)(hjs, this.app)` inside `try`/`catch`; a block that throws must render the error with `ui.errorState`, never break the note. This runs note text as code with the plugin's full access: fine for Just me; a Shareable build says so in its README and puts JS blocks behind an "Enable JS blocks" setting.

Register in `onload` with `this.registerMarkdownCodeBlockProcessor(settings.blockLang, (src, el, ctx) => …)` (so a new `blockLang` takes effect on reload) and re-render on `this.registerEvent(this.app.metadataCache.on('changed', …))`, debounced by `refreshMs`, only while `autoRefresh` is on. Use a `MarkdownRenderChild` per block (`ctx.addChild`) so unloading the note cleans up.

## Just me vs Shareable here

- **Just me:** single `main.js`, the three API calls the user's notes need, settings General + Rendering. Done when a sample note in the media vault (for example a table of watched films by rating) renders and logs are clean.
- **Shareable:** TypeScript project, the full API above with types, all settings groups plus a reset row, `fs:vault` permission, `helenite` range, a test for `pages()` filtering and error rendering, a README with the syntax and every setting.
