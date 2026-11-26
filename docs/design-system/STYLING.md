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
| `--hel-shadow-xs` | `0 1px 2px rgba(0, 0, 0, 0.05)` | The faint drop under a primary or danger button and a solid callout |
| `--hel-error-ring` | A 1px `--text-error` ring and a faint drop | An input with `aria-invalid="true"` (a `ui.field` showing an error) |
| `--hel-error-focus` | A 1px `--text-error` ring and a 4px red halo | That input while focused |
| `--hel-segment-track` | `var(--background-modifier-hover)` | The muted track behind a `hel-segmented` group's segments |
| `--hel-segment-active-bg` | `var(--background-primary)` | The chosen segment of `hel-segmented` (raised on the track) |
| `--hel-segment-active-fg` | `var(--text-normal)` | The text colour on it |
| `--hel-meter-width` | `56px` | The length of an inline `hel-meter`'s bar (`is-stacked` and `is-bar` fill the width) |
| `--hel-meter-height` | `4px` inline, `6px` stacked and bare | The thickness of that bar |
| `--hel-board-lane-width` | `280px` | The width of a `hel-board-lane` |
| `--hel-board-gap` | `var(--size-4-3)` | The space between a `hel-board`'s lanes |
| `--hel-table-ring` | `var(--background-modifier-border)` | The ring around a `hel-table`. This and the other `--hel-table-*` knobs are not declared anywhere: set one on `body` or an ancestor |
| `--hel-table-divider` | `var(--background-modifier-border)` | The hairline between its rows |
| `--hel-table-head` | `var(--background-secondary)` | The wash of its header and group rows |
| `--hel-table-hover` | `var(--background-modifier-hover)` | A body row under the pointer |
| `--hel-table-active` | `var(--background-modifier-active-hover)` | A clickable row while pressed |
| `--hel-table-radius` | `var(--hel-control-radius)` (6px) | The table's corners |
| `--hel-progress-fill` | `var(--interactive-accent)` | The filled part of a loading bar, and the spinner's moving arc. Like the other `--hel-progress-*` variables it is not declared anywhere |
| `--hel-progress-track` | `var(--background-modifier-border)` | The track behind a loading bar, a spinner and a `hel-meter` |
| `--hel-progress-height` | `6px` | The thickness of a loading bar |
| `--hel-slider-track` | `6px` | The thickness of a `hel-slider`'s track (a length, not a colour) |
| `--hel-slider-thumb` | `#fff` | The fill of its thumb |
| `--hel-bar-chart-height` | `110px` | The height of a `hel-bar-chart`'s columns |
| `--hel-bar-chart-color` | `var(--interactive-accent)` | The colour of its bars |
| `--hel-tab-indicator` | `var(--text-normal)` | The underline of the chosen `hel-tab` |
| `--hel-list-row-radius` | `var(--hel-control-radius)` | The corner radius of a `hel-list-row` and a list group's header |
| `--hel-kv-divider` | `var(--background-modifier-border)` | The hairline between the rows of a `hel-kv` |
| `--hel-thread-rail` | `var(--background-modifier-border)` | The rail beside a `hel-thread-replies` list |
| `--hel-thread-indent` | `var(--size-4-3)` | The space on each side of that rail |
| `--hel-modal-side-width` | `300px` | The width of a dialog's `hel-modal-side` column |
| `--hel-modal-side-divider` | `var(--background-modifier-border)` | The hairline between a dialog's content and its side column |
| `--hel-modal-bleed` | `4px` | The room inside a `hel-modal`'s scrolling content for the rings of parts that touch its edges (taken from the frame, so nothing moves) |
| `--hel-pane-header-border` | `var(--background-modifier-border)` | The hairline under a `hel-pane-header` |
| `--hel-subpage-header-bg` | `var(--background-primary)` | The sticky `hel-subpage-header` (it covers the page as it scrolls under) |
| `--hel-subpage-header-border` | `var(--background-modifier-border)` | The hairline under a `hel-subpage-header` |
| `--hel-summary-row-radius` | `var(--hel-control-radius)` | The corners of a clickable `hel-summary-row`'s hover wash and focus ring |
| `--hel-scope-bar-bg` | `var(--background-secondary)` | The `hel-scope-bar` banner while it edits Home |
| `--hel-scope-bar-defaults-bg` | A 8% `--interactive-accent` wash | The banner while it edits the Vault Defaults (`is-defaults`); its ring turns accent too |
| `--hel-vault-scope-rail` | `var(--background-modifier-border)` | The rail beside a `hel-vault-scope-list` |
| `--hel-toolbar-gap` | `var(--size-4-2)` | The space between a `hel-toolbar`'s controls |
| `--hel-button-active-bg` | `var(--interactive-accent)` | `hel-button.is-active` (a toggled toolbar button) |
| `--hel-button-active-fg` | `var(--text-on-accent)` | The text colour on it |
| `--hel-snackbar-bg` | `var(--background-modifier-message)` | A `hel-notice` (snackbar) background |
| `--hel-snackbar-fg` | `#fff` | Its text |
| `--hel-menu-radius` | `var(--hel-dialog-radius)` (12px) | The corner radius of a menu (`menu`) |
| `--hel-menu-item-radius` | `var(--hel-control-radius)` (6px) | The corner radius of a menu item |
| `--hel-suggest-min-width` | `200px` | The least width of an input suggester (`suggestion-container`) |
| `--hel-suggest-max-width` | `500px` | The width it grows to before a long row wraps (never wider than the window) |
| `--hel-suggest-max-height` | `300px` | How tall it grows before its list scrolls (never taller than the window) |
| `--hel-popover-width` | `320px` | The width of a `hel-popover` (`ui.popover`'s `width` sets it) |
| `--hel-popover-quote-max-height` | `80px` | How tall a popover's quote grows before it scrolls |
| `--hel-count-badge-attention-fg` | `var(--text-on-accent)` | The number on a danger `hel-count-badge` (on `--color-red`: about 6:1 in the default dark theme, 5:1 in light) |
| `--hel-callout-solid-fg` | `var(--text-on-accent)` | The text on a solid `hel-callout` |
| `--hel-card-min` | Set inline by `cardGrid` (150px unless `minWidth` is given) | The minimum card width in a `hel-cards` grid |

### Finesse tokens

The base theme's look comes from Finesse UI (Community, CC BY 4.0). Most of it is Obsidian's own variables (`--interactive-accent` is dark slate in light mode, light slate in dark mode; `--input-radius` and `--button-radius` are 6px; `--modal-radius` is 12px; `--font-default` starts with the bundled Inter). These `--hel-*` tokens fill the gaps. Parts use the rings in place of a 1px border.

| Variable | Default | Used by |
| --- | --- | --- |
| `--hel-ring` | Light: a 1px slate ring at 10% and a 1px drop shadow. Dark: a 1px hairline ring at 10% white | Controls: buttons, inputs, selects (via `--input-shadow`) |
| `--hel-ring-hover` | The same ring, stronger | A control under the pointer (via `--input-shadow-hover`) |
| `--hel-ring-card` | A faint ring and a soft drop shadow | Cards, thumbs (via `--shadow-s`) |
| `--hel-ring-overlay` | A faint ring and a deeper drop shadow | Menus, modals, popovers (via `--shadow-l`) |
| `--hel-ring-focus` | A 1px accent ring and a 4px accent halo | A focused control |
| `--hel-control-radius` | `var(--input-radius)` (6px) | Buttons, inputs, selects, tables |
| `--hel-card-radius` | `var(--radius-l)` (10px) | Cards |
| `--hel-dialog-radius` | `var(--modal-radius)` (12px) | Dialogs and modals |
| `--hel-badge-radius` | `var(--radius-s)` (4px) | Badges |
| `--hel-chip-radius` | `var(--hel-control-radius)` (6px) | Chips |
| `--hel-corner-shape` | `superellipse(1.5)` | `corner-shape` for smooth-rectangle corners where the engine has it |

## Classes

### Buttons and segmented controls

| Class | What it is |
| --- | --- |
| `hel-button` | A button made by `ui.button`. Also carries `mod-cta` (primary), `mod-warning` (danger) or `clickable-icon` (icon). With the `draggable` option it has `draggable="true"` (grab cursor), and `is-dragging` (50% opacity) while dragged. |
| `hel-button-icon` | The icon slot inside a button. Hidden when empty. |
| `hel-button-text` | The text slot inside a button. |
| `hel-segmented` | The group of a `ui.segmented` control. |
| `hel-segmented-label` | The group's label, such as "Editing:". |
| `hel-segment` | One option in the group. `aria-pressed="true"` marks the chosen one. |

Button states and variants: `is-link`, `is-active`, `is-busy`, `is-dragging`. A `ui.menuButton` is `is-menu` (with `aria-haspopup="menu"`), and shows a small chevron after its text.

Finesse Buttons and Icon Buttons: the primary (`mod-cta`) is the accent fill with a faint drop; the secondary is the `--interactive-normal` fill inside `--input-shadow`'s ring; the danger (`mod-warning`) darkens a step on hover. Every `hel-button` nudges down half a pixel when pressed, draws `--hel-ring-focus` on keyboard focus and is at 50% opacity when disabled. An icon button (`clickable-icon`) gets the active-hover wash when pressed and 40% opacity when disabled.

Finesse Segmented Control: the segments are joined on the `--hel-segment-track`; each is flat, muted text, normal text on hover; the chosen one (`aria-pressed="true"`) is raised: `--hel-segment-active-bg` with `--hel-ring`. A focused segment draws `--hel-ring-focus`; a disabled one is at 50%.

### Tables

| Class | What it is |
| --- | --- |
| `hel-table` | The `<table>` made by `ui.table`. Finesse-style: a soft ring and 6px corners instead of borders, a muted small header on a faint wash, hairline row dividers. Knobs: `--hel-table-ring`, `--hel-table-divider`, `--hel-table-head`, `--hel-table-hover`, `--hel-table-active`, `--hel-table-radius`. |
| `hel-table-row` | A body row, with a hover wash. `is-clickable` when the table has `onRowClick` (pointer cursor, pressed wash). |
| `hel-table-group` | A group heading row: the header's wash and muted small text. |
| `hel-table-actions` | The right-aligned actions column (header and cells). |
| `hel-table-buttons` | The wrapper around a row's action buttons. |

Cell states: `is-fit` (a `fit: true` column, header and cells: as wide as its content, on one line), `is-link` (clickable cell), `is-default` (faint text), `is-different` (accent, medium weight: a value that differs from the one beside it). A column's `state: (row) => 'default' | 'different'` sets the last two.

### States, badges and dots

| Class | What it is |
| --- | --- |
| `hel-empty` | `ui.emptyState`. Finesse: centered is a quiet panel (dashed `--background-modifier-border-hover` outline, `--hel-card-radius`, secondary background). Variants: `is-inline` (also `setting-item-description`), `is-pane` (also `pane-empty`), both unboxed. |
| `hel-loading` | `ui.loadingState`. `is-determinate` swaps the spinner for the progress bar (`progress` option or `setProgress`). Colours: `--hel-progress-fill` (default the accent) and `--hel-progress-track`; height `--hel-progress-height` (6px). |
| `hel-spinner` | The loading line's spinning ring (the `hel-spin` animation, slower under reduced motion). |
| `hel-loading-text` | The loading line's text. |
| `hel-progress` | The loading line's bar track (a `progressbar` with `aria-valuenow`); shown only with `is-determinate`. |
| `hel-progress-fill` | The bar's filled part; its width is the progress. |
| `hel-meter` | `ui.meter`: by default a reading on one line (label, short bar, text). `is-stacked` puts the label and text above a full-width bar; `is-bar` is only the bar (a table cell). Tones: `is-default` (muted fill), `is-accent`, `is-success`, `is-warning`, `is-danger`. Font and label colour come from the parent. |
| `hel-meter-label` | What the meter measures. |
| `hel-meter-bar` | The meter's track, a `progressbar` with `aria-valuenow`, named by the label (`--hel-meter-width`, `--hel-meter-height`, `--hel-progress-track`); left out when there is no value. |
| `hel-meter-fill` | The filled part of that track; its width is the value, its colour the tone. |
| `hel-meter-text` | The reading in words, in tabular figures; smaller, muted and right-aligned when stacked. |
| `hel-meter-head` | A stacked meter's first line: the label, and the reading at the end. |
| `hel-meter-sub` | The faint line under a meter (the `sub` option): smaller, muted text. |
| `hel-bar-chart` | `ui.barChart`: a column chart, the plot over its axis labels. |
| `hel-bar-chart-plot` | The columns on their baseline (`role="img"`, named by the label; `--hel-bar-chart-height`). |
| `hel-bar-chart-col` | One bucket's column, as tall as the plot, with `data-key` and the tooltip. |
| `hel-bar-chart-bar` | The bar in a non-zero column; its height is the share of the largest value, never under 2px (`--hel-bar-chart-color`). |
| `hel-bar-chart-axis` | The first and last bucket's labels under the baseline; left out when there are no buckets. |
| `hel-error` | `ui.errorState`, with its retry button. Finesse: centered is a panel with an 8% `--text-error` wash inside a 30% `--text-error` ring (`--hel-card-radius`); the text wraps and the retry button follows it. Variants: `is-inline`, `is-pane`, both unboxed. |
| `hel-error-text` | The message inside `hel-error`; wraps long text. |
| `hel-badge` | `ui.badge`. Tones: `is-default`, `is-accent`, `is-danger`, `is-success`, `is-warning`. Finesse Badges: a 10% tint of the tone (`--hel-badge-tone`, set per tone) inside a hairline ring of it, `--hel-badge-radius` corners, medium weight; the text is the tone's text colour (`--text-accent`, `--text-error`, `--text-success`; normal text for warning). |
| `hel-status-dot` | `ui.statusDot`, an 8px dot. Tones as for badges. `is-pulse` blinks it (the `hel-pulse` animation, off under reduced motion). |
| `hel-status-text` | `ui.statusText`. Tones as for badges. Finesse status text: medium weight, in the tone's text colour (`--text-muted`, `--text-accent`, `--text-error`, `--text-success`, `--text-warning`). Inside a `.status-bar-item` it takes the status bar's size (`--status-bar-font-size`) and tabular figures, so a ticking count keeps its width. |
| `hel-count-badge` | `ui.countBadge`, a solid pill with tabular numbers. `is-accent` (default), `is-danger` (red, `--hel-count-badge-attention-fg` text) or `is-warning` (normal text on an orange tint) is its tone; `is-pulse` blinks it. Hidden (the `hidden` attribute) at 0. In a tab header it is a centred pill with a small gap. |
| `is-overlay` / `hel-has-overlay-badge` | `ui.countBadge(..., { overlay: true })`: a small (14px, 10px text) badge out of the flow on the parent's top-right corner, so what it counts (a ribbon icon) never moves; it takes no clicks. The parent gets `hel-has-overlay-badge` (`position: relative`). |
| `hel-count-badge-icon` | The optional icon before a count badge's number. |
| `hel-count-badge-spoken` | The visually hidden text a screen reader reads for a count badge (the exact count and label). |
| `hel-chip` | `ui.chip`. Tones as for badges. Finesse Chips: the badge treatment (a 10% tint of the tone, `--hel-chip-tone`, inside a hairline ring of it, medium weight, the tone's text colour; normal text for warning) with `--hel-chip-radius` corners (default `--hel-control-radius`, 6px) and no border. |
| `hel-chip-remove` | A chip's × button. Also has `clickable-icon`. Fades up and gets a hover fill; `--hel-ring-focus` on keyboard focus. |
| `hel-avatar` | `ui.avatar`: initials in a circle, named for screen readers (and in its tooltip) by the whole text. Finesse Avatars: a soft muted tint inside a hairline ring, medium weight, `--text-normal` text, so light and dark follow the theme. Sizes: `is-small` (20px), `is-medium` (28px, the default), `is-large` (40px). |
| `hel-swatch` | `ui.swatch`: one CSS value on show, an image named by its label. Kinds: `is-color`, `is-radius`, `is-shadow` (a 28px square), `is-size` (a 64px track, tinted by `--hel-progress-track`), `is-font-family`, `is-font-size`, `is-font-weight` (a 40px box). |
| `hel-art` / `hel-art-image` | `ui.artwork`: a poster at 2:3 (`--hel-art-ratio`) and its picture, a background image. `is-missing` shows the title on a wash instead; a clickable one is a link that lifts on hover. |
| `hel-media-grid` | `ui.mediaGrid`: `is-grid` (equal columns, none narrower than `--hel-media-min`, 150px) or `is-strip` (one row that scrolls sideways). |
| `hel-media-card` | `ui.mediaCard`, a `hel-card` led by artwork. `is-tile` (artwork on top, centred text, the footer at the bottom) or `is-row` (a `--hel-media-row-art` (44px) artwork beside the text); `is-plain` has no ring or padding; `is-focused` has a strong ring (a card a link led to); a selected one is the card's `is-accent`. |
| `hel-media-title` / `hel-media-detail` | A media card's title (two lines, reserved) and its faint description (cut after two). |
| `hel-figures` / `hel-figure` | `ui.figures`: small figures in a wrapping row, or two to a line with `is-columns`. A linked figure is an `a`. |
| `hel-figure-icon` | The icon or mark before a figure. |
| `hel-rating` | `ui.rating`: stars filled to the value in `--hel-rating-color`. `is-none` keeps the space and shows nothing. |
| `hel-rating-base` / `hel-rating-fill` | The empty stars and the filled ones laid over them. |
| `hel-stats` | `ui.statTiles`: a ringed row of tiles, none narrower than `--hel-stat-min` (110px). |
| `hel-stat` / `hel-stat-value` / `hel-stat-label` | One tile (a button, `is-clickable`, when it has `onClick`), its number (`--hel-stat-size`, 24px) and what it counts. |
| `hel-heading` | `ui.sectionHeading`: a title line. `is-level-1` (a page title), `is-level-2`, `is-level-3`. |
| `hel-heading-title` / `hel-heading-extra` / `hel-heading-actions` | The heading, the faint note after it, and the buttons at the end of the line (not shown while empty). |
| `hel-month` | `ui.monthGrid`: seven columns of days, each with room for `--hel-month-rows` (3) events. `--hel-month-slot` and `--hel-month-line` size an event. |
| `hel-month-weekday` / `hel-month-day` / `hel-month-num` | The column names, a day (`is-today`, `is-outside` the month) and its number. |
| `hel-month-events` / `hel-month-event` | A day's events and one of them (a link when it has `onClick`). |
| `hel-month-event-lead` / `hel-month-event-title` | An event's short figure (`--hel-month-lead-color`) and its two-line title. |
| `hel-month-more` / `hel-month-list` | The "+N more" button of a full day, and the list its popover shows. |
| `hel-table-sort` / `hel-table-sort-label` | A sortable column's header button and its label; the arrow keeps its room, shown on the sorted column (`aria-sort`). |
| `hel-table-spacer` | In a tree column, an empty element that holds an expander's room on a row that has nothing to expand. |
| `hel-table-scroll` | The sideways scroller around a table with `minWidth`. |
| `is-fixed` / `is-end` / `is-truncate` / `is-tree` | On `ui.table`: fixed column widths; a right-aligned column; a one-line column cut with an ellipsis (`--hel-table-truncate`, 520px); the column that indents by a row's `data-level`. Rows below another have `is-nested`, rows that cannot be used `is-muted`. |
| `has-text` on `hel-meter.is-bar` | A bare meter with its reading beside the bar (`showText`), at least `--hel-meter-text-width` (4ch). |
| `is-all` | A bar chart axis naming every column (`labels: 'all'`). A column with `onSelect` is a button (`is-clickable`); a `muted` one is `is-muted`. |
| `is-armed` | `ui.button` with `armed`: the second click of a two-click delete, a danger fill at the same size. |
| `hel-frame-dialog` / `hel-frame-dialog-box` | `frameDialog` in `@helenite/ui-kit`: a large dialog an app draws itself (`--hel-frame-dialog-width`, `--hel-frame-dialog-height`). |
| `hel-swatch-fill` | The part of a swatch the value is set on, inline: its background, corners, shadow or width, or the "Aa" of a font. |

### Form controls, tabs and toolbar

Each control also carries Obsidian's class for the same control, so a theme's look for it applies: `dropdown`, `checkbox-container` (with `is-enabled` when on), `search-input-container`, `slider`. App frames have no Obsidian stylesheet, so `06-design-system.css` copies those looks under `:where()`, with no specificity: in the host, base.css and the theme always win.

| Class | What it is |
| --- | --- |
| `hel-field` | `ui.field`. `is-inline` puts the label and the control on one row; `is-fill` (`fill: true`) makes a text box, dropdown, search box, choice list or check list in `hel-field-control` take the slot's width; `is-invalid` while an error is shown (its control also gets `aria-invalid="true"`, which rings it in `--hel-error-ring`). |
| `hel-field-label` | The field's `<label>`, medium weight in normal text. |
| `hel-field-control` | The slot the control is drawn into. |
| `hel-field-hint` | The helper text line, in muted text. |
| `hel-field-error` | The error line from `setError`, in `--text-error`. Hidden while there is no error. |
| `hel-input` | `ui.textInput` (and the search box). `is-secret` for a password input; `is-multiline` for a `<textarea>` (`multiline: true`). Finesse Inputs: `--hel-ring` instead of a border (`--hel-ring-hover` on hover), `--hel-ring-focus` when focused, `--hel-error-ring` when `aria-invalid`, 50% on a secondary background when disabled, faint placeholder. |
| `hel-search` | The `<input>` of `ui.searchInput`, inside Obsidian's `search-input-container` with its `search-input-clear-button`. Ringed and focused as `hel-input`. |
| `hel-select` | `ui.dropdown`'s `<select>`, with `dropdown`. A soft ring instead of a border, a focus ring, 6px corners (`--hel-control-radius`). `is-compact` is shorter. |
| `hel-toggle` | The `<label>` of `ui.toggle`: the `checkbox-container` switch and the label text. `is-disabled` when disabled (50%). Finesse Toggles: the accent track when on, `--toggle-track-color` when off, each a step darker on hover; `--hel-ring-focus` around the switch on keyboard focus. |
| `hel-toggle-label` | The toggle's label text. |
| `hel-slider` | `ui.slider`'s `<input type="range">`, with `slider`. The track is filled with the accent up to the thumb: `ui.slider` sets `--hel-fill` (a percentage) on it as it moves. |
| `hel-tabs` | The tab strip from `ui.tabs`. Finesse Tabs: a flat strip on a hairline; muted text, normal text on hover (with a faint indicator); the chosen tab is normal text with a 2px `--hel-tab-indicator` underline (default `--text-normal`); `--hel-ring-focus` on keyboard focus. |
| `hel-tab` | One tab. `is-active` marks the chosen one. |
| `hel-tab-badge` | The count shown on a tab: a muted pill with tabular numbers; on the chosen tab an accent tint with `--text-accent`. Hidden at 0. |
| `hel-toolbar` | A row of controls made by `ui.toolbar`, on one baseline, `--hel-toolbar-gap` apart (default `--size-4-2`). A search box in it is 16em wide at most. |
| `hel-toolbar-end` | Add to a child of `hel-toolbar` to push it, and what follows, to the far end. |

### Callouts and cards

| Class | What it is |
| --- | --- |
| `hel-callout` | `ui.callout`, a banner or inline message. Also Obsidian's `callout` with `data-callout` (`info`, `note` for accent, `warning`, `danger`, `success`), so a theme's callout colours apply. Tones: `is-info`, `is-accent`, `is-warning`, `is-danger`, `is-success`. `is-solid` fills it with the tone's colour (`--hel-callout-solid-fg` text, a contrasting action button). Finesse Alerts: an 8% tint of the tone inside a hairline ring of it, 6px corners. |
| `hel-callout-text` | The callout's text. |
| `hel-callout-action` | The callout's button (a `hel-button`). |
| `hel-card` | `ui.card` (and each card of ui-kit's `cardGrid`): a `--hel-ring-card` ring (no border), `--hel-card-radius` corners, head, body and footer slots. In a `hel-cards` grid the ring rises on hover and shows the focus ring while the card's button has focus. Tones (a coloured ring): `is-accent`, `is-warning`, `is-muted`; `is-compact` has less padding. `is-attention` (a card waiting on the user: thick toned border, tint, focus ring, its own interface font with monospace only for code, and roomier choice-list rows with a tinted pick and key hints in muted text that brighten on hover, focus or pick), `is-sticky` (pinned to the top of its pane, with a shadow), `is-busy` (dimmed while its action runs) and `is-pulse` (briefly, from `pulse()`). |
| `hel-card-head` | The card's head: icon and title. Hidden while empty. |
| `hel-card-icon` | The head's icon. Also an icon before a settings row's name (`ui.settings.card`'s head). |
| `hel-card-title` | The card's title. |
| `hel-card-body` | The card's content. |
| `hel-card-footer` | The card's footer slot (`CardHandle.footer`): a strip under the body with a hairline above and a wash, for actions or a status. Hidden while empty. |
| `hel-disclosure` | `ui.disclosure`: a `hel-card` whose head (a button with `aria-expanded`) opens and closes the body and footer; `is-open` while open. The head has a pointer cursor and an accent outline inside the card on keyboard focus. The body's gap is `--size-4-2`. |
| `hel-disclosure-lead` | The head's slot before the title, for a badge or a chip. Hidden while empty. |
| `hel-disclosure-heading` | The title and summary (a chip put between them keeps its size). A long title wraps; the summary moves to its own line when less than 8em is left beside the title. |
| `hel-disclosure-summary` | The closed head's one-line summary, muted, at the far end, with an ellipsis. Hidden while open or empty. |
| `hel-disclosure-peek` | Content under the head that stays on show while closed. Hidden while empty. |

### Popover

| Class | What it is |
| --- | --- |
| `hel-popover` | `ui.popover`: a floating `role="dialog"` panel at an anchor, `--hel-popover-width` wide, on `--hel-ring-overlay` (no border) with `--hel-card-radius` corners over the primary background. The part places it (`position: fixed`, inline `left` and `top`, and a `max-height` in a short window); `data-side` is `bottom` or `top`. `--layer-popover`, or inside the modal it was opened from. |
| `hel-popover-head` | The popover's head: icon and title. Hidden while empty. |
| `hel-popover-icon` | The head's icon. |
| `hel-popover-title` | The title. A long unbroken one (a file path) wraps. |
| `hel-popover-body` | The popover's content; scrolls when the popover is capped. |
| `hel-popover-quote` | The `<blockquote>` of the `quote` option: muted text as written behind a hairline rail, scrolling past `--hel-popover-quote-max-height`. |
| `hel-popover-footer` | The footer slot (`PopoverHandle.footer`): a strip under the body with a hairline above and a wash. Hidden while empty. |

### Input suggesters

Obsidian's classes, made by `AbstractInputSuggest` and `EditorSuggest` (and the `file` and `folder` settings controls), not by a `ui` part.

| Class | What it is |
| --- | --- |
| `suggestion-container` | The popover under a text box or the editor's cursor. Finesse Menu: the primary background on `--hel-ring-overlay` (no border) with `--hel-menu-radius` corners. On `--layer-menu`, above modals, so a text box in Settings can open it. It opens under its anchor, or above when only that side has room, and gets an inline `max-height` when neither does. The rules for what is inside it have one class's specificity, so a plugin's or theme's row rules win. |
| `suggestion` | The list inside it; scrolls past `--hel-suggest-max-height`. |
| `suggestion-item` | One row: `--hel-menu-item-radius` corners, a hover wash on the chosen one (`is-selected`). A block, so highlighted text stays together and a long path wraps; a `mod-complex` row stays flex. |
| `suggestion-empty` | A muted line a suggester adds in place of rows (`suggestions.addMessage`). |
| `mod-search-suggestion` | On the container of every input and editor suggester, as in Obsidian. It looks like any `suggestion-container`; select it to restyle only these. |

### Boards

| Class | What it is |
| --- | --- |
| `hel-board` | `ui.board`: a row of lanes that fills the height it is given and scrolls sideways (`--hel-board-gap` apart). |
| `hel-board-page` | Add to the board's container: it fills the pane without scrolling, the rows above the board keep their height and the board takes the rest. A `hel-card` among those rows gets a margin below it, and its body scrolls sideways. |
| `hel-board-lane` | One lane, `--hel-board-lane-width` wide. |
| `hel-board-lane-head` | The lane's head slot (`BoardLaneHandle.head`), for its name, count and actions; a `hel-toolbar-end` child sits at the far end. Hidden while empty. With a `hel-board-lane-title` it stays one row: the title wraps and the rest sit level with its first line. |
| `hel-board-lane-title` | The lane's name (`BoardLaneOptions.title`): a `span`, or with `onTitleClick` a `button` that looks like text until hover (`--background-modifier-hover`) or keyboard focus (`--hel-ring-focus`). |
| `hel-board-list` | The lane's cards, scrolling on their own. `is-drop-target` (a dashed accent outline) while a card is dragged over it (or over the rest of its lane). |
| `hel-board-lane-footer` | The slot under the cards (`BoardLaneHandle.footer`), centred. It follows a short list and stays in view under a long one, which scrolls. Hidden while empty. |
| `hel-board-card` | A `hel-card` (`is-compact`) in a lane. `is-clickable` when it opens, `draggable="true"` when it moves (grab cursor); either raises the ring on hover (a toned card keeps its tone). `--hel-ring-focus` on keyboard focus, `is-dragging` (half opacity) while dragged. |
| `hel-board-card-meta` | The card's wrapping row of chips and badges (`BoardCardHandle.meta`). Hidden while empty. |
| `hel-board-card-row` | The card's row above the meta: checkbox, content and actions. Hidden while there is none of them. |
| `hel-board-card-check` | The done checkbox (`BoardCardOptions.check`), also a `hel-check`, level with the content's first line. |
| `hel-board-card-content` | The card's text or markdown (`BoardCardHandle.content`, also `markdown-rendered`), with the margins at its top and bottom edges trimmed. |
| `hel-board-card-actions` | Buttons at the far end of the row (`BoardCardHandle.actions`), level with the first line. Hidden while empty. |

### Check lists and choice lists

| Class | What it is |
| --- | --- |
| `hel-check-list` | `ui.checkList`, a `role=group` of checkboxes (also a form's `multi` field). |
| `hel-check` | One checkbox row (a `<label>`). `is-disabled` when disabled. Finesse Checkboxes: its `<input type=checkbox>` is a 16px box with `--hel-badge-radius` corners and a ring (darker on hover); checked, it fills with the accent (`--interactive-accent-hover` on hover) and shows a check mark in `--text-on-accent`; `--hel-ring-focus` on keyboard focus. |
| `hel-check-body` | The row's text and detail. |
| `hel-check-text` | The row's text. |
| `hel-check-detail` | The row's second line; also a form checkbox field's `detail`. |
| `hel-choice-list` | `ui.choiceList`, a listbox of option rows. `is-multi` when any number can be picked. |
| `hel-choice` | One option row. States: `is-selected`, `is-disabled`; `is-expandable` (top-aligned) when its detail is long (over 60 characters, or more than one line), then `is-open` while that detail is shown in full. In `ui.choose` the rows also have `hel-modal-choice`. Finesse Radio Buttons / Check Circles: a row with `--hel-ring` (its 1px border stays, transparent, for themes), `--hel-ring-hover` and a faint wash on hover, `--hel-ring-focus` on focus; a selected row has a 2px accent ring. |
| `hel-choice-icon` | The row's icon. |
| `hel-choice-body` | The row's title line and detail. |
| `hel-choice-title` | The title line: text and tag. |
| `hel-choice-text` | The option's text. |
| `hel-choice-tag` | The option's tag (a `hel-badge`). |
| `hel-choice-detail` | The option's second line. `is-clamped` keeps a long one to one line with an ellipsis. |
| `hel-choice-more` | The chevron of an `is-expandable` row, turned over while `is-open`. A click opens or closes the detail without picking the option; Right and Left arrow do the same from the keyboard. Hidden from screen readers (the row has `aria-expanded` once toggled). |
| `hel-choice-preview` | The option's `preview`, under its detail inside the row. |
| `hel-choice-key` | The key hint (a `<kbd>`). |
| `hel-choice-indicator` | The 16px circle before a row when the list has an `indicator`, ringed while unpicked: `is-radio` (a radio: filled with the accent and a light centre dot when selected) or `is-check` (a Check Circle: filled with the accent and a check mark when selected). |
| `hel-choice-badge` | The option's `badge` at the end of the row (a `hel-badge`). |
| `hel-choice-item` | The wrapper of an option that has a `trailing` slot: it draws the row's ring (the 2px accent ring when its option is selected), around the option and the slot. |
| `hel-choice-extra` | The `trailing` slot beside the option (outside the `role=option` element). |

### File and folder trees

A tree keeps Obsidian's DOM (`tree-item`, `tree-item-self`, `tree-item-inner`), and base.css styles its states, set with the `--nav-item-*` variables a theme already uses. The plugin handles the events and adds the classes.

| Selector | What it is |
| --- | --- |
| `.tree-item-self.is-being-dragged` | The row being dragged: half opacity. |
| `.tree-item-self.is-being-dragged-over` | The row the drag would drop on: the hover fill and a dashed accent outline. |
| `.tree-item-self > input.hel-input` | An inline rename box (`ui.textInput` put in place of the row's name): as tall as the row allows, so no row moves, with the design system's focus ring. |

### List rows and groups

With `obsidianClass: 'tree-item'` a row also carries Obsidian's `tree-item-self is-clickable nav-file-title`, its title `tree-item-inner nav-file-title-content` and its tag `nav-file-tag`; with `obsidianClass: 'nav-file-title'` only the `nav-file-*` classes. The row's own looks are under `:where()`, so base.css and a theme win for those rows. A group's chevron also has Obsidian's `collapse-icon`.

| Class | What it is |
| --- | --- |
| `hel-list-row` | `ui.listRow`, a row in a sidebar pane list. `is-active` marks the current one. Finesse list rows: a smooth-rectangle row (`--hel-list-row-radius`), the icon muted until hover (then normal text) and accent on the chosen row, the focus ring of the other controls. For drag reordering the plugin handles the drag events and adds `is-being-dragged` (half opacity) to the dragged row and `is-drop-target` (a dashed accent outline) to the row under it. |
| `hel-list-row-icon` | The row's icon. |
| `hel-list-row-title` | The row's title. |
| `hel-list-row-tag` | The row's tag ("not installed"). |
| `hel-list-row-status` | The row's status badge (`status`: a `hel-badge` with a tone class and a tooltip), after the tag. A long one ends in an ellipsis: at most 40% of the row. |
| `hel-list-row-chips` | The row's line of chips (`chips`), under `sub`. One line, never wrapping; the `hel-chip`s share it and end in an ellipsis. The row also gets `has-chips`, and `has-dot` when it has a status dot. |
| `hel-list-row-chips-more` | The "+N" chip after the first three when a row has five or more; its tooltip names the rest. Keeps its width. |
| `hel-list-row-sub` | The row's second line (`sub`). The row also gets `has-sub`, and `has-dot` when it has a status dot. |
| `hel-list-row-chevron` | The trailing chevron (`chevron: true`): the row opens something. Faint; nudges right on hover. Hidden from screen readers. |
| `hel-list-row-meta` | The row's faint meta text (a time, a folder). It gives way to the title: at most half the row, then an ellipsis. In a two-line row it ends the title's line. |
| `hel-list-row-actions` | The row's icon buttons, shown on hover, focus or when active. |
| `hel-list-row-action` | One of those buttons (a `hel-button`). |
| `hel-list-group` | `ui.listGroup`. `is-collapsed` while collapsed. |
| `hel-list-group-header` | The group's header (a `role=button`), drawn as Finesse's section label: small, medium weight, muted, normal text on hover. |
| `hel-list-group-chevron` | The header's chevron. `is-collapsed` turns it. |
| `hel-list-group-title` | The group's title. |
| `hel-list-group-count` | The group's count. |
| `hel-list-group-body` | The container for the group's rows. Hidden while collapsed. |

### Code blocks

| Class | What it is |
| --- | --- |
| `hel-code-block` | `ui.codeBlock`, a `<pre>` of source code (Finesse has none, so it is drawn from the tokens): the monospace font at `--font-ui-smaller` on the `--code-background` fill inside a hairline ring (`--hel-ring`, the accent focus ring `--hel-ring-focus` on keyboard focus), never wrapped (a long line scrolls sideways) and selectable. The rule is `pre.hel-code-block`, so a reading view's `pre` style does not wrap it. |

### Composer and key-value lists

| Class | What it is |
| --- | --- |
| `hel-composer` | `ui.composer`: a text box and a send button. `is-busy` while a submit runs. |
| `hel-composer-input` | The `<textarea>`: the Finesse input ring, hover ring and accent focus ring (`--hel-ring-focus`). |
| `hel-composer-host` | The element `createInput` added, drawn as the box in place of the `<textarea>`: the same fill, text and input, hover and focus rings, at least `--hel-composer-rows` (from `rows`) lines tall, scrolling past `--hel-composer-max-height` (320px). A textarea or input inside gives up its own box. A CodeMirror editor inside gives up its own padding, height and line width; its cursor, selection and placeholder follow the theme, and image embeds are thumbnails `--hel-composer-thumb-size` (52px) tall with the `--hel-composer-thumb-cursor` cursor. |
| `hel-composer-send` | The send button (a `hel-button`). |
| `hel-composer-hint` | The line under the box. |
| `hel-composer-attach` | The attach button (`onAttach`), a `clickable-icon` before the box; the composer then has `has-attach`. Muted, normal text on hover. |
| `hel-composer-attachments` | The row of attachment chips above the box; hidden while empty. |
| `hel-composer-attachment` | One chip: a ring (`--hel-ring`) badge-radius pill with `hel-composer-attachment-icon`, `hel-composer-attachment-name` (ellipsised) and `hel-composer-attachment-remove`. |
| `hel-composer-menu` | The "/" menu above the box (`slashCommands`), a `role="listbox"`. |
| `hel-composer-menu-item` | One command; `is-selected` on the highlighted one. `hel-composer-menu-name` and `hel-composer-menu-desc` inside. |
| `hel-kv` | `ui.keyValue`, a `<dl>`. A Finesse-style key-value list (Finesse has none, so it is drawn from the tokens): two columns, the keys muted and medium weight, the values in normal text. |
| `hel-kv-row` | One key and its value. Rows share the list's columns (subgrid) and are split by a `--hel-kv-divider` hairline. |
| `hel-kv-key` | The key (`<dt>`). |
| `hel-kv-value` | The value (`<dd>`). `is-empty` when it shows the empty text. A list value stacks its items without bullets. A list item is `is-new` when `isNew` marks it, plus `is-warning` with `newTone: 'warning'`. |

### Threads

| Class | What it is |
| --- | --- |
| `hel-thread` | `ui.thread`: a threaded conversation (Finesse has none, so it is drawn from the tokens), its entries and event lines spaced apart. A `hel-callout` directly in a list drops its own margin. |
| `hel-thread-entry` | One comment (an `<article>`): its card, then its replies. |
| `hel-thread-replies` | The list under an entry, indented along a `--hel-thread-rail` rail by `--hel-thread-indent`. `is-flat` past `maxIndent` (3): no indent and no rail, so a long back-and-forth is not squeezed. |
| `hel-thread-event` | A muted line for something that happened. It is also a `hel-thread-text`. |
| `hel-thread-text` | `ui.threadText`: text as written, line breaks kept and long words wrapped. |

### Modals

| Class | What it is |
| --- | --- |
| `hel-modal` | The modal element for `ui.confirm`, `ui.prompt`, `ui.choose`, `ui.form` and `ui.dialog`. Also has `is-confirm`, `is-prompt`, `is-choose`, `is-form` or `is-dialog`; `is-wide` for a dialog with `width: 'wide'`. Finesse dialog: `--hel-ring-overlay` (a faint ring and a deep drop shadow) in place of the border (kept, transparent, so a theme's `--modal-border-color` still has a place), `--hel-dialog-radius` (12px) corners, a 24px frame and a semibold title; the close button is a 6px control with the focus ring. Only `.hel-modal` is styled this way: the Settings modal and plugins' own `Modal`s keep the base look. A vault app's `api.ui.modal` is drawn by the host as a `ui.dialog`, so it looks the same. |
| `hel-modal-body` | The element a `ui.dialog`'s `render` draws into. `has-side-panel` once `ctx.sidePanel()` split it; it is then a size container (`hel-modal-body`) for stacking the columns. |
| `hel-modal-split` | The two columns `ctx.sidePanel()` adds to the body. Each column scrolls on its own, within the height the dialog has left. One column, content first, scrolling as one, while the body is 600px wide or narrower. |
| `hel-modal-main` | The content column, a vertical stack. |
| `hel-modal-side` | The side column (a ticket's properties), `--hel-modal-side-width` wide behind a `--hel-modal-side-divider` hairline. Stacked, it spans the dialog with the hairline above it. |
| `hel-modal-title-icon` | A `ui.dialog`'s `icon`, before the title text in Obsidian's `modal-title`. |
| `hel-modal-message` | The message paragraph of a confirm modal, a form's `message`, and a vault app modal's `{ text }` block. Muted text. |
| `hel-modal-label` | A field label: normal text, medium weight, above its input. |
| `hel-modal-input` | A text input. |
| `hel-modal-field` | One field row in a form. |
| `hel-modal-check` | A checkbox row. Its `detail` follows as a `hel-check-detail`. |
| `hel-modal-error` | The inline validation message, and the message of a failed `onConfirm`, `onSubmit` or dialog action. A Finesse error alert (error text on a faint error wash with a faint error ring, control radius) above the actions; hidden while empty. |
| `hel-modal-actions` | The button row at the bottom (Cancel, then the action), right-aligned and pinned to the bottom of a tall modal. The main action is a primary (`mod-cta`) button, or the danger fill (`mod-warning`) for a destructive one. Also Obsidian's `modal-button-container`; `hel-modal-actions`' own spacing wins over base.css's, and a theme's `modal-button-container` rules apply. While an action runs, its button is `is-busy` (with a progress cursor over the row) and the others are disabled. |
| `hel-modal-choices` | The scrolling list of choices: a `hel-choice-list`. |
| `hel-modal-choice` | One choice: a `hel-choice` (see Choice lists). |

### Settings

| Class | What it is |
| --- | --- |
| `hel-section` | The container `ui.settings.section` returns, under a heading row. |
| `hel-summary-row` | A `setting-item` with a one-line summary. `is-clickable` when the whole row opens something: Finesse washes it on hover (`--hel-summary-row-radius`; the wash spreads past the row so the text stays put), outlines it in the accent while its chevron has keyboard focus, and fades the chevron (`extra-setting-button`) to faint, nudging it right on hover. `is-subpage` when it opens a sub-page (`ui.settings.subpageRow`). |
| `hel-subpage` | The drill-in page opened by `ui.settings.openSubpage`. While one is open, the tab's content container has `has-subpage` and its other children are hidden. |
| `hel-subpage-header` | The page header: Back button and title. Finesse: sticky at the top of the page on `--hel-subpage-header-bg`, over a hairline (`--hel-subpage-header-border`). |
| `hel-subpage-back` | The Back button: the standard `back` action (`ui.action`, an icon button named "Back"). Takes a ring on hover; focused when the page opens. |
| `hel-subpage-title` | The title text: semibold, one line, ellipsis when long. |
| `hel-scope-bar` | The "Editing: Home / Vault Defaults" bar from `ui.settings.scopeBar`: a `hel-segmented` and a hint. Finesse: a ringed banner on `--hel-scope-bar-bg`; `is-defaults` while it edits the Vault Defaults, with the `--hel-scope-bar-defaults-bg` wash and an accent ring. |
| `hel-scope-bar-hint` | The hint at the bar's end: where a change goes ("Changes apply to Home only.", "Changes apply to every vault that has not set its own."). |
| `hel-settings-card` | `ui.settings.card`: a `hel-card` with no fill whose first child is a `setting-item` (the head; its icon is a `hel-card-icon` in the name, its status a `hel-status-text` under the description), then the `hel-card-body`. |
| `hel-vault-scope` | `ui.settings.vaultScope`: its `setting-item` row (with a `dropdown`) and the list under it. Not drawn with `inline: true`, where the `dropdown` and the list go straight into the given element. |
| `hel-vault-scope-list` | The vault list: a `hel-check-list`, on a rail (`--hel-vault-scope-rail`) under its row. Has the `hidden` attribute while the scope is all or none. |
| `hel-vault-scope-note` | A line in the list ("Home can always use it.", "No other vaults yet."). Also `setting-item-description`. |
| `setting-item is-disabled` | A settings row turned off with `setDisabled(true)` (`ui.settings.row`, or Obsidian's `Setting`). Finesse: the name and description are at 50% and the controls take no pointer input. `setDisabled` also disables the row's own components, which draw their disabled look; a control added to `controlEl` by hand has to be disabled by its owner, so the keyboard skips it too. |

### Notices and menus

| Class | What it is |
| --- | --- |
| `hel-notice` | The message element of the notice made by `ui.notice` (inside Obsidian's `notice`, which draws the bar). Kinds: `is-info`, `is-success`, `is-error`, shown as a small leading dot in the kind's colour (`--hel-notice-tone`). `is-clickable` when it has `onClick` (lighter on hover). Finesse Snackbars: `--hel-snackbar-bg` with `--hel-snackbar-fg` text, 6px corners, `--shadow-l`. |
| `hel-notice-text` | The notice's text, when it has an action. |
| `hel-notice-action` | The notice's action button (a `hel-button`): pushed to the end, flat, semibold, a light wash on hover. |

| Class | What it is |
| --- | --- |
| `menu` | Obsidian's menu, made by `ui.menu`. Finesse Menu: the primary background on `--hel-ring-overlay` (no border), `--hel-menu-radius` corners, small padding. |
| `menu-item` | One item: icon, title, 6px corners, a hover wash. `is-disabled` is at 50%. |
| `menu-item-icon` | The leading icon, muted. The trailing check of a `checked` item (`mod-checked`) is pushed to the end in normal text. |
| `menu-separator` | A hairline between groups. |
| `menu-item.is-danger` | A red label and icon, with a faint red wash on hover (`ui.menu` adds it for `danger: true`; Obsidian's `is-warning` looks the same). |

`menu-item.is-danger` is Obsidian's `menu-item` with a red label and icon; `ui.menu` adds it for `danger: true` items. A `checked` item is Obsidian's `menu-item.mod-checked` with its check icon.

### Pane header

| Class | What it is |
| --- | --- |
| `hel-pane-header` | `ui.paneHeader`. Also Obsidian's `nav-header`; holds a `nav-buttons-container` (`role=toolbar`) of icon `hel-button`s that are also `nav-action-button`. Finesse: on a hairline (`--hel-pane-header-border`) with the buttons a little apart; the rest of its look is base.css and the theme. |

### Vault app parts (`@helenite/ui-kit`)

Defined in `packages/ui-kit/src/ui-kit.css`. Only vault apps use these. The parts ui-kit re-exports from `@helenite/ui` (form controls, tabs, toolbar, card, lists and the rest) are styled by `06-design-system.css` (above).

| Class | What it is |
| --- | --- |
| `hel-cards` | The grid from `cardGrid`. Its minimum card width is `--hel-card-min`. Each card is a `hel-card` with a `hel-card-body` and `hel-card-title`, with the grid's hover and focus ring (see Callouts and cards). |
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
