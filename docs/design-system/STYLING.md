# Styling contract

Helenite's design-system parts are styled by `packages/base-theme/css/06-design-system.css`. The extra parts that vault apps get from `@helenite/ui-kit` are styled by `packages/ui-kit/src/ui-kit.css`. This page lists every class and variable in both files, so a theme or plugin can restyle a part without reading the stylesheet.

## Rules

- Parts use Obsidian's documented CSS variables (`--text-muted`, `--interactive-accent`, `--size-4-2`, and so on). A `--hel-*` variable exists only where Obsidian has none, and its default is an Obsidian variable.
- Every part's root element has a `hel-<part>` class. Where Obsidian has a class for the same thing, the root also has it: `mod-cta`, `mod-warning`, `clickable-icon`, `setting-item`, `callout`, `dropdown`, `checkbox-container`, `modal-button-container`, `nav-header`.
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
| `--hel-count-badge-attention-fg` | `var(--text-on-accent)` | The number on a danger `hel-count-badge` (on `--color-red`: about 6:1 in the default dark theme, 5:1 in light) |
| `--hel-callout-solid-fg` | `var(--text-on-accent)` | The text on a solid `hel-callout` |
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

Button states and variants: `is-link`, `is-active`, `is-busy`. A `ui.menuButton` is `is-menu` (with `aria-haspopup="menu"`).

### Tables

| Class | What it is |
| --- | --- |
| `hel-table` | The `<table>` made by `ui.table`. |
| `hel-table-row` | A body row. `is-clickable` when the table has `onRowClick`. |
| `hel-table-group` | A group heading row. |
| `hel-table-actions` | The right-aligned actions column (header and cells). |
| `hel-table-buttons` | The wrapper around a row's action buttons. |

Cell states: `is-fit` (a `fit: true` column, header and cells: as wide as its content, on one line), `is-link` (clickable cell), `is-default` (faint text), `is-different` (accent text: a value that differs from the one beside it).

### States, badges and dots

| Class | What it is |
| --- | --- |
| `hel-empty` | `ui.emptyState`. Variants: `is-inline` (also `setting-item-description`), `is-pane` (also `pane-empty`). |
| `hel-loading` | `ui.loadingState`. |
| `hel-error` | `ui.errorState`, with its retry button. Variants: `is-inline`, `is-pane`. |
| `hel-badge` | `ui.badge`. Tones: `is-default`, `is-accent`, `is-danger`, `is-success`, `is-warning`. |
| `hel-status-dot` | `ui.statusDot`. Tones as for badges. `is-pulse` blinks it (the `hel-pulse` animation, off under reduced motion). |
| `hel-status-text` | `ui.statusText`. Tones as for badges. |
| `hel-count-badge` | `ui.countBadge`. `is-accent` (default), `is-danger` (red, `--hel-count-badge-attention-fg` text) or `is-warning` (normal text on an orange tint) is its tone; `is-pulse` blinks it. Hidden (the `hidden` attribute) at 0. In a tab header it is a centred pill with a small gap. |
| `is-overlay` / `hel-has-overlay-badge` | `ui.countBadge(..., { overlay: true })`: a small (14px, 10px text) badge out of the flow on the parent's top-right corner, so what it counts (a ribbon icon) never moves; it takes no clicks. The parent gets `hel-has-overlay-badge` (`position: relative`). |
| `hel-count-badge-icon` | The optional icon before a count badge's number. |
| `hel-count-badge-spoken` | The visually hidden text a screen reader reads for a count badge (the exact count and label). |
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
| `hel-input` | `ui.textInput` (and the search box). `is-secret` for a password input; `is-multiline` for a `<textarea>` (`multiline: true`). |
| `hel-search` | The `<input>` of `ui.searchInput`, inside Obsidian's `search-input-container` with its `search-input-clear-button`. |
| `hel-select` | `ui.dropdown`'s `<select>`, with `dropdown`. `is-compact` is shorter. |
| `hel-toggle` | The `<label>` of `ui.toggle`: the `checkbox-container` switch and the label text. `is-disabled` when disabled. |
| `hel-toggle-label` | The toggle's label text. |
| `hel-slider` | `ui.slider`'s `<input type="range">`, with `slider`. |
| `hel-tabs` | The tab strip from `ui.tabs`. |
| `hel-tab` | One tab. `is-active` marks the chosen one. |
| `hel-tab-badge` | The count shown on a tab. |
| `hel-toolbar` | A row of controls made by `ui.toolbar`. |

### Callouts and cards

| Class | What it is |
| --- | --- |
| `hel-callout` | `ui.callout`, a banner or inline message. Also Obsidian's `callout` with `data-callout` (`info`, `note` for accent, `warning`, `danger`, `success`), so a theme's callout colours apply. Tones: `is-info`, `is-accent`, `is-warning`, `is-danger`, `is-success`. `is-solid` fills it with the tone's colour (`--hel-callout-solid-fg` text, a contrasting action button). |
| `hel-callout-text` | The callout's text. |
| `hel-callout-action` | The callout's button (a `hel-button`). |
| `hel-card` | `ui.card` (and each card of ui-kit's `cardGrid`). Tones: `is-accent`, `is-warning`, `is-muted`; `is-compact` has less padding. `is-attention` (a card waiting on the user: thick toned border, tint, focus ring, its own interface font with monospace only for code, and roomier choice-list rows with a tinted pick and key hints in muted text that brighten on hover, focus or pick), `is-sticky` (pinned to the top of its pane, with a shadow), `is-busy` (dimmed while its action runs) and `is-pulse` (briefly, from `pulse()`). |
| `hel-card-head` | The card's head: icon and title. Hidden while empty. |
| `hel-card-icon` | The head's icon. Also an icon before a settings row's name (`ui.settings.card`'s head, the vault rows of Accounts). |
| `hel-card-title` | The card's title. |
| `hel-card-body` | The card's content. |

### Check lists and choice lists

| Class | What it is |
| --- | --- |
| `hel-check-list` | `ui.checkList`, a `role=group` of checkboxes (also a form's `multi` field). |
| `hel-check` | One checkbox row (a `<label>`). `is-disabled` when disabled. |
| `hel-check-body` | The row's text and detail. |
| `hel-check-text` | The row's text. |
| `hel-check-detail` | The row's second line; also a form checkbox field's `detail`. |
| `hel-choice-list` | `ui.choiceList`, a listbox of option rows. `is-multi` when any number can be picked. |
| `hel-choice` | One option row. States: `is-selected`, `is-disabled`. In `ui.choose` the rows also have `hel-modal-choice`. |
| `hel-choice-icon` | The row's icon. |
| `hel-choice-body` | The row's title line and detail. |
| `hel-choice-title` | The title line: text and tag. |
| `hel-choice-text` | The option's text. |
| `hel-choice-tag` | The option's tag (a `hel-badge`). |
| `hel-choice-detail` | The option's second line. |
| `hel-choice-preview` | The option's `preview`, under its detail inside the row. |
| `hel-choice-key` | The key hint (a `<kbd>`). |
| `hel-choice-indicator` | The mark before a row when the list has an `indicator`: `is-radio` (a radio dot) or `is-check` (a checkbox), filled when the row is selected. |
| `hel-choice-badge` | The option's `badge` at the end of the row (a `hel-badge`). |
| `hel-choice-item` | The wrapper of an option that has a `trailing` slot: it draws the row's border, around the option and the slot. |
| `hel-choice-extra` | The `trailing` slot beside the option (outside the `role=option` element). |

### List rows and groups

With `obsidianClass: 'tree-item'` a row also carries Obsidian's `tree-item-self is-clickable nav-file-title`, its title `tree-item-inner nav-file-title-content` and its tag `nav-file-tag`; with `obsidianClass: 'nav-file-title'` only the `nav-file-*` classes. The row's own looks are under `:where()`, so base.css and a theme win for those rows. A group's chevron also has Obsidian's `collapse-icon`.

| Class | What it is |
| --- | --- |
| `hel-list-row` | `ui.listRow`, a row in a sidebar pane list. `is-active` marks the current one. |
| `hel-list-row-icon` | The row's icon. |
| `hel-list-row-title` | The row's title. |
| `hel-list-row-tag` | The row's tag ("not installed"). |
| `hel-list-row-meta` | The row's faint meta text (a time, a folder). |
| `hel-list-row-actions` | The row's icon buttons, shown on hover, focus or when active. |
| `hel-list-row-action` | One of those buttons (a `hel-button`). |
| `hel-list-group` | `ui.listGroup`. `is-collapsed` while collapsed. |
| `hel-list-group-header` | The group's header (a `role=button`). |
| `hel-list-group-chevron` | The header's chevron. `is-collapsed` turns it. |
| `hel-list-group-title` | The group's title. |
| `hel-list-group-count` | The group's count. |
| `hel-list-group-body` | The container for the group's rows. Hidden while collapsed. |

### Composer and key-value lists

| Class | What it is |
| --- | --- |
| `hel-composer` | `ui.composer`: a text box and a send button. `is-busy` while a submit runs. |
| `hel-composer-input` | The `<textarea>`. |
| `hel-composer-send` | The send button (a `hel-button`). |
| `hel-composer-hint` | The line under the box. |
| `hel-kv` | `ui.keyValue`, a `<dl>`. |
| `hel-kv-row` | One key and its value. |
| `hel-kv-key` | The key (`<dt>`). |
| `hel-kv-value` | The value (`<dd>`). `is-empty` when it shows the empty text. A list item is `is-new` when `isNew` marks it, plus `is-warning` with `newTone: 'warning'`. |

### Modals

| Class | What it is |
| --- | --- |
| `hel-modal` | The modal element for `ui.confirm`, `ui.prompt`, `ui.choose`, `ui.form` and `ui.dialog`. Also has `is-confirm`, `is-prompt`, `is-choose`, `is-form` or `is-dialog`; `is-wide` for a dialog with `width: 'wide'`. |
| `hel-modal-body` | The element a `ui.dialog`'s `render` draws into. |
| `hel-modal-title-icon` | A `ui.dialog`'s `icon`, before the title text in Obsidian's `modal-title`. |
| `hel-modal-message` | The message paragraph of a confirm modal, and a form's `message`. |
| `hel-modal-label` | A field label. |
| `hel-modal-input` | A text input. |
| `hel-modal-field` | One field row in a form. |
| `hel-modal-check` | A checkbox row. Its `detail` follows as a `hel-check-detail`. |
| `hel-modal-error` | The inline validation message, and the message of a failed `onConfirm`, `onSubmit` or dialog action. Collapses when empty. |
| `hel-modal-actions` | The button row at the bottom (Cancel, then the action). Also Obsidian's `modal-button-container`; `hel-modal-actions`' own spacing wins over base.css's, and a theme's `modal-button-container` rules apply. While an action runs, its button is `is-busy` and the others are disabled. |
| `hel-modal-choices` | The scrolling list of choices: a `hel-choice-list`. |
| `hel-modal-choice` | One choice: a `hel-choice` (see Choice lists). |

### Settings

| Class | What it is |
| --- | --- |
| `hel-section` | The container `ui.settings.section` returns, under a heading row. |
| `hel-summary-row` | A `setting-item` with a one-line summary. `is-clickable` when the whole row opens something. |
| `hel-subpage` | The drill-in page opened by `ui.settings.openSubpage`. While one is open, the tab's content container has `has-subpage` and its other children are hidden. |
| `hel-subpage-header` | The page header: Back button and title. |
| `hel-subpage-title` | The title text. |
| `hel-scope-bar` | The "Editing: Home / Vault Defaults" bar from `ui.settings.scopeBar`. |
| `hel-settings-card` | `ui.settings.card`: a `hel-card` with no fill whose first child is a `setting-item` (the head; its icon is a `hel-card-icon` in the name, its status a `hel-status-text` under the description), then the `hel-card-body`. |
| `hel-vault-scope` | `ui.settings.vaultScope`: its `setting-item` row (with a `dropdown`) and the list under it. Not drawn with `inline: true`, where the `dropdown` and the list go straight into the given element. |
| `hel-vault-scope-list` | The vault list: a `hel-check-list`. Has the `hidden` attribute while the scope is all or none. |
| `hel-vault-scope-note` | A line in the list ("Home can always use it.", "No other vaults yet."). Also `setting-item-description`. |

### Notices and menus

| Class | What it is |
| --- | --- |
| `hel-notice` | The notice made by `ui.notice`. Kinds: `is-info`, `is-success`, `is-error`. `is-clickable` when it has `onClick`. |
| `hel-notice-text` | The notice's text, when it has an action. |
| `hel-notice-action` | The notice's action button (a `hel-button`). |

`menu-item.is-danger` is Obsidian's `menu-item` with a red label and icon; `ui.menu` adds it for `danger: true` items. A `checked` item is Obsidian's `menu-item.mod-checked` with its check icon.

### Pane header

| Class | What it is |
| --- | --- |
| `hel-pane-header` | `ui.paneHeader`. Also Obsidian's `nav-header`; holds a `nav-buttons-container` (`role=toolbar`) of icon `hel-button`s that are also `nav-action-button`. Styled by base.css and the theme only. |

### Vault app parts (`@helenite/ui-kit`)

Defined in `packages/ui-kit/src/ui-kit.css`. Only vault apps use these. The parts ui-kit re-exports from `@helenite/ui` (form controls, tabs, toolbar, card, lists and the rest) are styled by `06-design-system.css` (above).

| Class | What it is |
| --- | --- |
| `hel-cards` | The grid from `cardGrid`. Its minimum card width is `--hel-card-min`. Each card is a `hel-card` with a `hel-card-body` and `hel-card-title` (see Callouts and cards). |
| `hel-card-main` | The card's clickable area. |
| `hel-card-poster` | The poster slot of a card. |
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
