# Styling contract

Helenite's design-system parts are styled by `packages/base-theme/css/06-design-system.css`. The extra parts that vault apps get from `@helenite/ui-kit` are styled by `packages/ui-kit/src/ui-kit.css`. This page lists every class and variable in both files, so a theme or plugin can restyle a part without reading the stylesheet.

## Rules

- Parts use Obsidian's documented CSS variables (`--text-muted`, `--interactive-accent`, `--size-4-2`, and so on). A `--hel-*` variable exists only where Obsidian has none, and its default is an Obsidian variable.
- Every part's root element has a `hel-<part>` class. Where Obsidian has a class for the same thing, the root also has it: `mod-cta`, `mod-warning`, `clickable-icon`, `setting-item`.
- Variants are `is-<variant>` (`is-link`, `is-danger`). States are `is-<state>` (`is-busy`, `is-selected`).
- The `--hel-*` variables are declared on `body`, not `:root`. They refer to theme variables such as `--interactive-accent`, and those are defined on `body` (`.theme-light` / `.theme-dark`). A `:root` declaration would resolve them to nothing. Override them on `body` or a descendant.

## Themes and snippets in vault apps

A vault app runs in a sandboxed frame. Every frame loads its stylesheets in this order: the app base, the design-system stylesheet (the parts' styles), the app's own `view.css`, the active theme, then the enabled snippets. Later wins, so a theme or snippet that restyles a `hel-*` class also restyles it inside apps. When the user changes the theme or toggles a snippet, open app frames update live.

An app that sets `theme: isolate` in its `app.md` frontmatter skips the theme and snippet CSS. It still gets the theme's variables and the design-system stylesheet. The default is `theme: inherit`; any other value is a manifest error.

Forwarding does not widen the app's access. An `inherit` app can read the theme's and snippets' CSS text in its own document, but the frame's content security policy is unchanged: network use is still blocked (`img-src` is limited to the app's `net` hosts, and `font-src` allows `data:` only).

## Variables

| Variable | Default | Used by |
| --- | --- | --- |
| `--hel-segment-active-bg` | `var(--interactive-accent)` | The pressed segment of `hel-segmented`, and `hel-button.is-active` |
| `--hel-segment-active-fg` | `var(--text-on-accent)` | The text colour on those |
| `--hel-card-min` | Set inline by `cardGrid` (150px unless `minWidth` is given) | The minimum card width in a `hel-cards` grid |

## Classes

### Buttons and segmented controls

| Class | What it is |
| --- | --- |
| `hel-button` | A button made by `ui.button`. Also carries `mod-cta` (primary), `mod-warning` (danger) or `clickable-icon` (icon). |
| `hel-button-icon` | The icon slot inside a button. Hidden when empty. |
| `hel-button-text` | The text slot inside a button. |
| `hel-segmented` | The group of a `ui.segmented` control. |
| `hel-segmented-label` | The group's label, such as "Editing:". |
| `hel-segment` | One option in the group. `aria-pressed="true"` marks the chosen one. |

Button states and variants: `is-link`, `is-active`, `is-busy`.

### Tables

| Class | What it is |
| --- | --- |
| `hel-table` | The `<table>` made by `ui.table`. |
| `hel-table-row` | A body row. `is-clickable` when the table has `onRowClick`. |
| `hel-table-group` | A group heading row. |
| `hel-table-actions` | The right-aligned actions column (header and cells). |
| `hel-table-buttons` | The wrapper around a row's action buttons. |

Cell states: `is-link` (clickable cell), `is-default` (faint text).

### States, badges and dots

| Class | What it is |
| --- | --- |
| `hel-empty` | `ui.emptyState`. Variants: `is-inline` (also `setting-item-description`), `is-pane` (also `pane-empty`). |
| `hel-loading` | `ui.loadingState`. |
| `hel-error` | `ui.errorState`, with its retry button. Variants: `is-inline`, `is-pane`. |
| `hel-badge` | `ui.badge`. Tones: `is-default`, `is-accent`, `is-danger`, `is-success`, `is-warning`. |
| `hel-status-dot` | `ui.statusDot`. Tones as for badges. `is-pulse` blinks it (the `hel-pulse` animation, off under reduced motion). |
| `hel-status-text` | `ui.statusText`. Tones as for badges. |
| `hel-count-badge` | `ui.countBadge`. `is-pulse` blinks it. Hidden (the `hidden` attribute) at 0. |
| `hel-chip` | `ui.chip`. Tones as for badges. |
| `hel-chip-remove` | A chip's × button. Also has `clickable-icon`. |

### Form controls, tabs and toolbar

Each control also carries Obsidian's class for the same control, so a theme's look for it applies: `dropdown`, `checkbox-container` (with `is-enabled` when on), `search-input-container`, `slider`. App frames have no Obsidian stylesheet, so `06-design-system.css` copies those looks under `:where()`, with no specificity: in the host, base.css and the theme always win.

| Class | What it is |
| --- | --- |
| `hel-field` | `ui.field`. `is-inline` puts the label and the control on one row; `is-invalid` while an error is shown. |
| `hel-field-label` | The field's `<label>`. |
| `hel-field-control` | The slot the control is drawn into. |
| `hel-field-hint` | The hint line. |
| `hel-field-error` | The error line from `setError`. Hidden while there is no error. |
| `hel-input` | `ui.textInput` (and the search box). `is-secret` for a password input. |
| `hel-search` | The `<input>` of `ui.searchInput`, inside Obsidian's `search-input-container` with its `search-input-clear-button`. |
| `hel-select` | `ui.dropdown`'s `<select>`, with `dropdown`. `is-compact` is shorter. |
| `hel-toggle` | The `<label>` of `ui.toggle`: the `checkbox-container` switch and the label text. `is-disabled` when disabled. |
| `hel-toggle-label` | The toggle's label text. |
| `hel-slider` | `ui.slider`'s `<input type="range">`, with `slider`. |
| `hel-tabs` | The tab strip from `ui.tabs`. |
| `hel-tab` | One tab. `is-active` marks the chosen one. |
| `hel-tab-badge` | The count shown on a tab. |
| `hel-toolbar` | A row of controls made by `ui.toolbar`. |

### Modals

| Class | What it is |
| --- | --- |
| `hel-modal` | The modal element for `ui.confirm`, `ui.prompt`, `ui.choose` and `ui.form`. Also has `is-confirm`, `is-prompt`, `is-choose` or `is-form`. |
| `hel-modal-message` | The message paragraph of a confirm modal. |
| `hel-modal-label` | A field label. |
| `hel-modal-input` | A text input. |
| `hel-modal-field` | One field row in a form. |
| `hel-modal-check` | A checkbox row. |
| `hel-modal-error` | The inline validation message. Collapses when empty. |
| `hel-modal-actions` | The button row at the bottom (Cancel, then the action). |
| `hel-modal-choices` | The scrolling list of choices. |
| `hel-modal-choice` | One choice. States: `is-selected`, `is-disabled`. |
| `hel-modal-choice-detail` | A choice's second line. |

### Settings

| Class | What it is |
| --- | --- |
| `hel-section` | The container `ui.settings.section` returns, under a heading row. |
| `hel-summary-row` | A `setting-item` with a one-line summary. `is-clickable` when the whole row opens something. |
| `hel-subpage` | The drill-in page opened by `ui.settings.openSubpage`. While one is open, the tab's content container has `has-subpage` and its other children are hidden. |
| `hel-subpage-header` | The page header: Back button and title. |
| `hel-subpage-title` | The title text. |
| `hel-scope-bar` | The "Editing: Home / Vault Defaults" bar from `ui.settings.scopeBar`. |

### Notices and menus

| Class | What it is |
| --- | --- |
| `hel-notice` | The notice made by `ui.notice`. Kinds: `is-info`, `is-success`, `is-error`. |

`menu-item.is-danger` is Obsidian's `menu-item` with a red label and icon; `ui.menu` adds it for `danger: true` items.

### Vault app parts (`@helenite/ui-kit`)

Defined in `packages/ui-kit/src/ui-kit.css`. Only vault apps use these. The form controls, tabs and toolbar that ui-kit re-exports are styled by `06-design-system.css` (above).

| Class | What it is |
| --- | --- |
| `hel-cards` | The grid from `cardGrid`. Its minimum card width is `--hel-card-min`. |
| `hel-card` | One card. |
| `hel-card-main` | The card's clickable area. |
| `hel-card-poster` | The poster slot of a card. |
| `hel-card-body` | The text block of a card. |
| `hel-card-title` | A card's title. |
| `hel-card-sub` | A card's subtitle. |
| `hel-card-meta` | A card's meta line. |
| `hel-card-badges` | The badge row of a card. |
| `hel-card-remove` | A card's remove button. |
| `hel-poster` | A poster image, or its initial when there is no image. |
| `hel-poster-initial` | The initial shown in place of a missing poster. |
| `hel-poster-item` | One item in a poster row. |
| `hel-poster-title` | A poster item's title. |
| `hel-poster-sub` | A poster item's subtitle. |
| `hel-row-title` | The heading of a poster row. |
| `hel-row-track` | The scrolling track of a poster row. |
| `hel-picker` | The picker from `picker`. |
| `hel-picker-list` | The picker's option list. |
| `hel-option` | One option. States: `is-selected`, `is-active`, `is-disabled`. |
| `hel-option-detail` | An option's second line. |
| `hel-option-none` | The "No matches" line. |
| `hel-cal` | The calendar strip from `calendarStrip`. |
| `hel-cal-day` | One day. States: `is-today`, `is-selected`. |
| `hel-cal-dow` | The weekday name. |
| `hel-cal-num` | The day number. |
| `hel-cal-dots` | The row of event dots. |
| `hel-dot` | One event dot. |
| `hel-cal-more` | The "+n" overflow count. |

## Example

Make a primary button's pressed colour a theme colour, and give badges square corners:

```css
body {
  --hel-segment-active-bg: var(--color-purple);
  --hel-segment-active-fg: var(--background-primary);
}
.hel-badge { border-radius: 0; }
```

Select by the `hel-` class and an `is-` variant. Do not select by the part's element or by Obsidian's class alone (`.mod-cta` matches every Obsidian button, not just Helenite's).
