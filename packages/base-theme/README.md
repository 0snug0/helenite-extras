# @helenite/base-theme

`css/*.css` is Helenite's clean-room base stylesheet (concatenated to `dist/base.css` by `pnpm build`) (derived from `spikes/themes/helenite-base.css`). It defines the CSS variable names Obsidian documents publicly, with Helenite's own values, and the component CSS that consumes them. Themes are deltas on top of it. The desktop shell links it first in the cascade.

Nothing here is copied from Obsidian's `app.css`. Do not paste Obsidian CSS into this package.

Everything below is the Phase 0 theme spike's findings, kept here as the contract for this package.

---

# Phase 0 theme spike: findings

**Recommendation: GO.** Minimal, AnuPpuccin and Things all render correctly on Helenite's clean-room markup and base stylesheet, in light and dark, across every region in the fixture (workspace, Live Preview, reading view, settings, dialog, menu, command palette). Nothing is broken. The remaining differences come from the fact that themes are *deltas on top of the host's defaults*: where a theme doesn't override something, Helenite's own default shows through.

What was built (all in this folder, nothing outside it):

| File | What it is |
|---|---|
| `helenite-base.css` | Clean-room base (~1,240 lines). Defines 585 Obsidian-documented variable names with Helenite's own values on `body` / `.theme-light` / `.theme-dark`, plus the component CSS that *consumes* them (workspace, tabs, tree, editor, reading view, callouts, modals, menus, settings, controls). |
| `fixture.html` | Static Obsidian-shaped DOM: ribbon, left sidedock with file explorer, root split with two tab groups (Live Preview + reading view), right sidedock (outline + tags), status bar, and overlay states (settings modal, confirmation dialog + context menu + notice, command palette). |
| `loader.js` | The runtime bits themes depend on: body scheme class, `theme.css` injected as a `<style>` after the base, a clean-room Style Settings reader, Lucide icons as `svg.svg-icon.lucide-*`, and callout icons resolved from the computed `--callout-icon`. |
| `scripts/fetch-themes.mjs` | Downloads `theme.css` + `manifest.json` from each theme's latest GitHub release into `vendor-themes/` (gitignored, user-install style, never vendored). |
| `scripts/shoot.mjs` | Playwright: 4 themes × 2 modes × 4 states → `screenshots/`, plus computed-style probes per region → `results/probes.json`. |
| `scripts/audit-vars.mjs` | Static audit: variables each theme uses but doesn't define, and classes it targets that the fixture lacks → `results/var-audit.json`. |
| `scripts/inspect.mjs`, `scripts/ab-style-settings.mjs`, `scripts/contact-sheet.py` | Debug helpers (matched CSS rules via CDP), the Style Settings A/B, and per-theme contact sheets. |

Re-run: `npm install && npx playwright install chromium-headless-shell && npm run fetch-themes && npm run shoot && npm run audit`.

Themes tested: Minimal 9.1.4 (MIT, released 2026-10-06), AnuPpuccin v1.5.0 (GPL-3.0, 2024-05-10), Things 2.2.6 (MIT, 2026-11-01).

## Screenshots

Contact sheets: rows are light then dark; columns are workspace, settings, dialog+menu, command palette.

- Base only (no theme): [sheet](screenshots/sheet-none.png) · [dark workspace](screenshots/none-dark-workspace.png) · [light workspace](screenshots/none-light-workspace.png)
- Minimal: [sheet](screenshots/sheet-Minimal.png) · [light](screenshots/Minimal-light-workspace.png) · [dark](screenshots/Minimal-dark-workspace.png)
- AnuPpuccin: [sheet](screenshots/sheet-AnuPpuccin.png) · [light](screenshots/AnuPpuccin-light-workspace.png) · [dark](screenshots/AnuPpuccin-dark-workspace.png) · [dark without Style Settings](screenshots/AnuPpuccin-dark-without-style-settings.png) · [dark, Frappé flavor via Style Settings](screenshots/AnuPpuccin-dark-flavor-frappe.png)
- Things: [sheet](screenshots/sheet-Things.png) · [light](screenshots/Things-light-workspace.png) · [dark](screenshots/Things-dark-workspace.png)

Every individual shot is `screenshots/<theme>-<mode>-<state>.png`.

## Scorecard

"Works" means the theme visibly takes effect and the region is laid out correctly. It does **not** mean pixel parity with real Obsidian: no Obsidian reference screenshots were taken (see "What this spike did not prove").

| Region | Minimal | AnuPpuccin | Things |
|---|---|---|---|
| Ribbon | works | works | works |
| Left sidedock, tab icons | works | works | works |
| File explorer (`.nav-folder` / `.nav-file-title`, active, selected, file tags) | works | works | works |
| Root tab bar, active / inactive tabs | works | works | works |
| View header (breadcrumb, nav, actions) | works¹ | works | works |
| Live Preview: headings, emphasis, links, tags | works | partly² | works |
| Live Preview: lists, tasks, quote, code block, callout widget | works | works | works |
| Properties (`.metadata-*`, pills) | works | works | works |
| Reading view: headings, inline, links, tags | works | works | works |
| Reading view: lists, tasks, table, code, blockquote, footnotes | works | works | works |
| Callouts (colour, icon, fold) | works | works³ | partly⁴ |
| Right sidedock (outline, tag pane) | works | works | works |
| Status bar | works | works | works |
| Settings modal (vertical tabs, setting items, toggle, slider, dropdown, buttons) | works | works | partly⁴ |
| Dialog, context menu, notice | works | works | works |
| Command palette (prompt, suggestions, hotkeys) | works | works | works |
| Light and dark | both | both | both |

1. Minimal deliberately fades the title until hover (`opacity: 0` with a transition). This is intended design, not breakage.
2. AnuPpuccin sets `.cm-header { display: inline-block }`. On the *active* heading line, where the `## ` marker is visible, a long heading wraps under the marker in a narrow pane. This is the theme's own rule acting on the documented two-span structure (`cm-formatting-header` + `cm-header`), so real Obsidian very likely does the same. Not verified against Obsidian.
3. Its default callout fold sits next to the title (`flex-grow: var(--anp-callout-fold-position, 0)`). This was **our** gap at first (fixed, see below).
4. Things doesn't restyle the note callout or the settings toggle (probes show computed values identical to base-only), so those show **Helenite's** defaults rather than what a Things user sees in Obsidian. This is the general fidelity risk explained in finding 3.

Per-region probe diff against the base-only run (`results/probes.json`): Minimal and AnuPpuccin restyled 25/25 probed regions; Things restyled 23/25.

## Key findings

1. **Variables are the easy part.** Excluding theme-private namespaces (`--anp-*`, `--ctp-*`), each theme needs only a small set of variables from the host. Minimal needs 38 and Things 28; AnuPpuccin needs 158, of which 113 are its own Style Settings variables with in-CSS fallbacks. After the spike, the base leaves undefined only names that are theme typos or theme-private: `--background-modifer-border`, `--backgrouund-modifier-border`, `--h2`, `--font-todoist-*`, `--highlight-text-color--active`, `--thin-border`, `--border-color`, `--gutter-background`, `--checkbox-icon`, `--tab-stacked-spine-order`. Obsidian probably doesn't define these either, but that wasn't verified.
2. **Themes rely on the host's component CSS, not just its variables.** A theme overrides `--background-secondary` and expects the *host* to paint the sidebar with it. So `helenite-base.css` must reproduce *where* each variable is consumed, not only define it. This is most of the base file, and it is what makes the sidebars, tabs, callouts and settings pick up theme colours automatically.
3. **Where a theme doesn't override, Helenite shows through.** This is the main residual fidelity risk. Examples: the Things callout and toggle, and AnuPpuccin's accent without Style Settings (it falls back to Helenite teal). Mitigation for the real product: give the base's *default values* close to Obsidian's documented defaults (the docs publish default values for most variables), especially sizes, spacing and radii, and keep Helenite's own look as a separate bundled theme or snippet. Get counsel's sign-off on using documented default values.
4. **Style Settings is required for AnuPpuccin's real look, and its semantics matter.** With no Style Settings, AnuPpuccin keeps its default Mocha palette (background is the same pixel value) but loses its accent, which falls back to Helenite teal, and its per-heading colours ([A/B](screenshots/AnuPpuccin-dark-without-style-settings.png)). With it, the flavor classes, accent and per-heading colours come from **class-toggle / class-select defaults only**. An early version that also emitted *variable* defaults broke AnuPpuccin: white background and serif font, because empty `variable-text` defaults produced invalid `font-family` values. Reading the plugin's `SettingsManager.ts` behaviour confirmed it writes CSS variables only for values the user has saved in `data.json`. Note that both light and dark flavor classes (`ctp-latte`, `ctp-mocha`) end up on `body` at once, and themes rely on `.theme-dark.ctp-mocha` to choose. Overrides work: `?ss=anuppuccin-theme-dark=ctp-frappe` switches the flavor ([shot](screenshots/AnuPpuccin-dark-flavor-frappe.png)). The Style Settings plugin is GPL-3.0, and Helenite's implementation must be clean-room. The format is documented in its README; only behaviour was read here, not code copied.
5. **Some styling is applied by JS, not CSS.** Callout icons come from the computed `--callout-icon` (themes change it), and graph colours are read with `getComputedStyle`. The host has to do those lookups after theme CSS loads.
6. **Renderer details leak into theme results.** Themes set `white-space: pre-wrap` on editor containers, so any whitespace-only text node between CM6 lines renders as a blank line. Real CM6 and the reading-view renderer emit none, and Helenite's renderers must keep it that way. The fixture strips them.

### Our gaps found and fixed during the spike

| Gap | Symptom | Fix |
|---|---|---|
| Heading size set on both `.HyperMD-header-N` and the inner `.cm-header-N` | Source-view headings at ~3× size | Size only on the line (`helenite-base.css`) |
| `.callout-title-inner { flex: 1 }` shorthand | AnuPpuccin overrides `flex-grow: 0`, leaving basis 0%, so the title wrapped | Use `flex-grow: 1` only |
| Whitespace text nodes in the fixture | Huge gaps between lines in Minimal/AnuPpuccin | Strip in `loader.js`; renderer requirement noted above |
| Style Settings wrote variable defaults | AnuPpuccin white and serif | Match real semantics: classes get defaults, variables only saved values |
| `--font-editor-override` undefined | Minimal/Things editor font chain | Added alongside the other `*-override` slots |

## Required contract (what Helenite must emit)

**Body classes:** `theme-light|theme-dark`, platform (`mod-macos|mod-windows|mod-linux`), `is-frameless`, `is-hidden-frameless`, `is-focused`, `show-inline-title`, `show-view-header`, `show-ribbon`, `styled-scrollbars` / `native-scrollbars`, `css-settings-manager`, plus Style Settings class toggles and selects. Inline body style carries the user's accent and fonts.

**Cascade:** base, then plugin `styles.css`, then `theme.css` (as a `<style>`), then snippets, then the Style Settings `<style>` (`body.css-settings-manager`, `body.theme-light.css-settings-manager`, `body.theme-dark.css-settings-manager`).

**DOM, in the exact nesting `fixture.html` uses** (themes use descendant and child selectors on it):
- Shell: `.app-container > .horizontal-main-container > .workspace` with `.workspace-ribbon.side-dock-ribbon.mod-left`, `.workspace-split.mod-horizontal.mod-sidedock.mod-left-split`, `.workspace-split.mod-vertical.mod-root`, `.workspace-split.mod-horizontal.mod-sidedock.mod-right-split`. The status bar `.status-bar > .status-bar-item.plugin-<id>` sits inside `.app-container`.
- Tabs: `.workspace-tabs(.mod-top/.mod-active/.mod-top-left-space)` > `.workspace-tab-header-container` > `.workspace-tab-header-container-inner` > `.workspace-tab-header(.is-active.mod-active)[data-type]` > `.workspace-tab-header-inner` > `-icon` / `-title` / `.workspace-tab-header-status-container` / `-close-button`. Then `.workspace-tab-header-new-tab`, `-spacer`, `-tab-list`, `.sidebar-toggle-button.mod-left/right`, `.workspace-tab-container > .workspace-leaf > .workspace-leaf-content[data-type][data-mode]` > `.view-header` (`-left`, `-nav-buttons`, `-title-container > -title-parent > .view-header-breadcrumb`, `.view-header-title`, `.view-actions > .view-action`) and `.view-content`. Every split and tab group needs `hr.workspace-leaf-resize-handle`.
- File explorer: `.nav-header > .nav-buttons-container > .nav-action-button`, `.nav-files-container > .tree-item.nav-folder.mod-root > .tree-item-children.nav-folder-children`, folders as `.tree-item.nav-folder(.is-collapsed) > .tree-item-self.nav-folder-title.mod-collapsible[data-path] > .tree-item-icon.collapse-icon.nav-folder-collapse-indicator + .tree-item-inner.nav-folder-title-content`, files as `.tree-item.nav-file > .tree-item-self.nav-file-title[data-path](.is-active/.is-selected) > .tree-item-inner.nav-file-title-content (+ .nav-file-tag)`. Keep `data-path`. Also `.workspace-sidedock-vault-profile`.
- Editor: `.markdown-source-view.cm-s-obsidian.mod-cm6.is-live-preview.is-readable-line-width.is-folding.show-properties > .cm-editor > .cm-scroller > .cm-sizer > .inline-title + .metadata-container + .cm-contentContainer > .cm-content > .cm-line`. Line classes and token spans as listed in `research-dom-inventory.md` §3D. The spike exercised `HyperMD-header-N`, `HyperMD-list-line(-N)`, `HyperMD-task-line[data-task]`, `HyperMD-quote(-N)`, `HyperMD-codeblock(-begin/-end)(-bg)`, `cm-active`, `cm-formatting-*`, `cm-hashtag(-begin/-end)`, `cm-hmd-internal-link`, `cm-embed-block.markdown-rendered.cm-callout > .callout`, `.edit-block-button` and `.list-bullet`.
- Reading view: `.markdown-reading-view > .markdown-preview-view.markdown-rendered(...) > .markdown-preview-sizer.markdown-preview-section > .markdown-preview-pusher + .mod-header + div.el-* … + .mod-footer`. Inside: `ul.has-list-bullet > li > span.list-bullet`, `.contains-task-list > li.task-list-item[data-task](.is-checked) > input.task-list-item-checkbox`, `a.tag`, `.internal-link(.is-unresolved)`, `.external-link`, `pre > code.language-* > .token.*`, `.copy-code-button`, footnotes.
- Callout: `.callout[data-callout][data-callout-metadata][data-callout-fold](.is-collapsible.is-collapsed) > .callout-title > .callout-icon + .callout-title-inner (+ .callout-fold) ; .callout-content`.
- Overlays: `.modal-container.mod-dim > .modal-bg + .modal(.mod-settings) > .modal-close-button + .modal-header > .modal-title + .modal-content (+ .modal-button-container)`; settings `.vertical-tab-header > .vertical-tab-header-group > -title + -items > .vertical-tab-nav-item(.is-active)` and `.vertical-tab-content > .setting-item(.mod-toggle/.setting-item-heading) > .setting-item-info(name, description) + .setting-item-control`, `.checkbox-container(.is-enabled)`, `select.dropdown`, `input.slider`, `button.mod-cta|.mod-warning`; `.menu > .menu-scroll > .menu-group > .menu-item(.selected/.is-warning) > .menu-item-icon + .menu-item-title`, `.menu-separator`; `.prompt > .prompt-input-container > .prompt-input`, `.prompt-results > .suggestion-item(.is-selected)`, `.prompt-instructions`; `.notice-container > .notice`.
- Icons: `svg.svg-icon.lucide-<name>`.

**Variables:** the 585 defined in `helenite-base.css`. The minimum set these three themes actually pull from the host is in `results/vars-needed-from-base.txt` (198 names including theme-private ones; per-theme lists in `results/var-audit.json`). Keep the deprecated `*-rgb` and `*-hsl` aliases (`--color-red-rgb`, `--color-accent-hsl`, `--interactive-accent-hsl`, `--mono-rgb-100`). All three themes use them.

## What this spike did not prove (follow-ups)

- **Pixel parity with Obsidian.** There's no reference screenshot from a real, user-installed Obsidian. Next step: run the same fixture content in Obsidian locally, screenshot it, and diff. This is the quartz-themes approach and it is how finding 3 gets quantified.
- **Untested DOM** (classes that at least two of the three themes target and the fixture lacks; 80 in total, mostly plugin views): hover popovers and embeds (`.popover`, `.markdown-embed*`, `.internal-embed`), stacked tabs (`.mod-stacked`), collapsed sidedock (`.is-sidedock-collapsed`), `.is-translucent`, `.is-popout-window`, `.is-fullscreen`, line-number gutters (`.cm-gutterElement`, `.cm-lineNumbers`), `HyperMD-header-4..6`, `.list-collapse-indicator`, search results, canvas/graph, PDF viewer, print, mobile classes, the Style Settings UI itself (`.style-settings-*`), and plugin views (Kanban, Dataview, Tasks, Calendar, Excalidraw). Most themes ship large plugin-specific sections, so plugin compatibility decides how much of a theme a user actually sees.
- **The real editor.** The CM6 DOM here is hand-written. The editor spike has to produce the same classes and no stray text nodes.
- **Legal.** AnuPpuccin and Style Settings are GPL-3.0. Themes stay user-downloaded (`vendor-themes/` is gitignored). Helenite's Style Settings reader must stay clean-room. Include it in the counsel review.
