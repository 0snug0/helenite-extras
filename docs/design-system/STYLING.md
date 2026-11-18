# Styling contract

Helenite's design-system parts are styled by `packages/base-theme/css/06-design-system.css`. This page lists every class and variable in that file, so a theme or plugin can restyle a part without reading the stylesheet.

## Rules

- Parts use Obsidian's documented CSS variables (`--text-muted`, `--interactive-accent`, `--size-4-2`, and so on). A `--hel-*` variable exists only where Obsidian has none, and its default is an Obsidian variable.
- Every part's root element has a `hel-<part>` class. Where Obsidian has a class for the same thing, the root also has it: `mod-cta`, `mod-warning`, `clickable-icon`, `setting-item`.
- Variants are `is-<variant>` (`is-link`, `is-danger`). States are `is-<state>` (`is-busy`, `is-selected`).
- The `--hel-*` variables are declared on `body`, not `:root`. They refer to theme variables such as `--interactive-accent`, and those are defined on `body` (`.theme-light` / `.theme-dark`). A `:root` declaration would resolve them to nothing. Override them on `body` or a descendant.

## Variables

| Variable | Default | Used by |
| --- | --- | --- |
| `--hel-segment-active-bg` | `var(--interactive-accent)` | The pressed segment of `hel-segmented`, and `hel-button.is-active` |
| `--hel-segment-active-fg` | `var(--text-on-accent)` | The text colour on those |

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
| `hel-empty` | `ui.emptyState`. |
| `hel-loading` | `ui.loadingState`. |
| `hel-error` | `ui.errorState`, with its retry button. |
| `hel-badge` | `ui.badge`. Tones: `is-accent`, `is-danger`, `is-success`. |
| `hel-status-dot` | `ui.statusDot`. Tones: `is-accent`, `is-danger`, `is-success`. |

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

### Gallery

These style Settings, Design system. Plugins should not use them.

`hel-gallery-section`, `hel-gallery-heading`, `hel-gallery-demo`, `hel-gallery-code`.

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
