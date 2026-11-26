# Helenite design system

Helenite gives plugins a set of ready-made UI parts (buttons, tables, modals, settings rows and so on) through a module named `helenite`. Use them instead of building your own: they look right in every theme and behave the same everywhere.

To see every part running, open **Settings, Design system**. Each part is shown live next to the code that makes it.

For restyling, see [STYLING.md](./STYLING.md). A working plugin that uses every part, with no stylesheet of its own, is in [catalog/plugins/sample-design-system](../../catalog/plugins/sample-design-system/README.md).

New to building for Helenite? Start with the developer guide, [docs/dev](../dev/README.md): it scaffolds a plugin, theme or vault app (`node packages/create-helenite/bin.mjs`) and explains where these parts fit.

## Types

The types live in the workspace package `@helenite/types`. It is private and not published to npm yet, so there is no `npm install` for it. In this repository, build it:

```
pnpm --filter @helenite/types build
```

That writes `packages/types/helenite.d.ts`, a `declare module 'helenite'` file. Include it in your plugin's `tsconfig.json` (`"include": ["src", "<path>/helenite.d.ts"]`).

## Import

```ts
import { ui, version } from 'helenite';
```

`version` is the running Helenite version (`0.1.0` today). The public types are exported from the same module, type-only: `ButtonOptions`, `ButtonHandle`, `TableOptions`, `TableColumn`, `TableGroup`, `Field`, `Tone`, `StateVariant`, `ErrorStateOptions`, `CountBadgeOptions`, `CountBadgeHandle`, `CountBadgeTone`, `AvatarOptions`, `ChipOptions`, `FieldOptions`, `FieldHandle`, `TextInputOptions`, `SearchInputOptions`, `SliderOptions`, `ToggleOptions`, `ToggleHandle`, `DropdownOptions`, `DropdownHandle`, `TabSpec`, `TabsOptions`, `TabsHandle`, `FieldValues`, `CalloutOptions`, `CalloutHandle`, `CalloutTone`, `CardOptions`, `CardHandle`, `CardTone`, `CheckOption`, `CheckListOptions`, `CheckListHandle`, `ChoiceOption`, `ChoiceListOptions`, `ChoiceListHandle`, `ListRowOptions`, `ListRowAction`, `ListGroupOptions`, `ComposerOptions`, `ComposerHandle`, `PopoverAnchor`, `PopoverCloseReason`, `PopoverOptions`, `PopoverHandle`, `CodeBlockOptions`, `KeyValueRow`, `ThreadOptions`, `Thread`, `ThreadEntry`, `MenuItemSpec`, `MenuOptions`, `MenuButtonOptions`, `MenuHandle`, `ActionId`, `ActionOptions`, `SubpageLink`, `ConfirmOptions`, `PromptOptions`, `ChooseOptions`, `FormOptions`, `DialogOptions`, `DialogAction`, `DialogContext`, `DialogSidePanel`, `NoticeOptions`, `NoticeHandle`, `PaneHeaderAction`, `SettingsCardOptions`, `SettingsCardHandle`, `SettingsCardStatus`, `VaultScope`, `VaultScopeKind`, `VaultScopeOptions`, `VaultScopeHandle`.

`helenite` is provided by Helenite at run time. Mark it external in your bundler (like `obsidian`). Obsidian itself has no such module, so `require('helenite')` throws there.

## Plugins that run in Obsidian too

Guard the require, and fall back to plain Obsidian UI when it fails:

```ts
let hel: typeof import('helenite') | undefined;
try { hel = require('helenite'); } catch {}

if (hel) hel.ui.notice('Saved', { kind: 'success' });
else new Notice('Saved');
```

## Manifest

Say which Helenite versions your plugin works with:

```json
{ "id": "my-plugin", "helenite": "^0.1.0" }
```

If the manifest already has a `helenite` object, put the range in its `version`:

```json
{ "helenite": { "version": "^0.1.0" } }
```

Supported ranges: an exact `x.y.z`, `>=x.y.z`, and `^x.y.z`. For `0.y.z`, `^0.1.0` means 0.1.0 or later but below 0.2.0. Any other form is refused as unreadable. If the range is not met, the plugin is not loaded, and a notice explains why.

## Parts

The parts that draw into the page (button, segmented, table, the states, badge, dot, status text, count badge, chip, avatar, swatch, picker grid, the form controls, tabs, toolbar, callout, card, disclosure, check list, choice list, list row and group, composer, key-value list, code block, thread, action, menu button, the settings parts) take the element to draw into as their first argument and append to it; `ui.paneHeader` puts itself first in its pane. `ui.popover` takes its anchor first. Modals take `app` first, `ui.menu` takes an event or point, and `ui.notice` takes only its text.

### ui.button

```ts
const save = ui.button(el, { text: 'Save', variant: 'primary', onClick: async () => { await store.save(); } });
save.setDisabled(true);
```

Variants: `default`, `primary`, `danger`, `link`, `icon`. An icon button needs a `label` (it becomes the accessible name). When `onClick` returns a promise, the button shows busy until it settles and ignores clicks meanwhile. The handle has `setText`, `setDisabled`, `setBusy` and `setPressed`.

### ui.segmented

```ts
ui.segmented(el, { label: 'View:', value: 'list', options: [{ value: 'list', text: 'List' }, { value: 'grid', text: 'Grid' }], onChange: (v) => show(v) });
```

One choice from a few. Use it for a view or a scope, not for a long list.

### ui.table

```ts
ui.table<Plugin>(el, {
  columns: [{ key: 'name', title: 'Name', cell: (p) => p.name }, { key: 'version', title: 'Version', fit: true, cell: (p) => p.version }],
  rows: plugins, empty: 'No plugins installed.',
  actions: (p, cell) => ui.action(cell, 'configure', { onClick: () => open(p) }),
});
```

A column's `cell` returns the text, or returns nothing and fills the `td` itself. Pass `groups` (`{ title, rows }`) instead of `rows` for grouped tables, and `onRowClick` to make rows clickable. `setRows` / `setGroups` on the handle redraw it. `empty` is shown when there are no rows.

Headers are one line, and a cell breaks a word only when that word alone is wider than the table can give it, so no column is squeezed into "Ver/sio/n". Mark a column of short values (a version, a toggle, a dropdown, a button) `fit: true`: it is as wide as its content and never wraps, and the column with long text (a name and description) takes the rest of the width.

### ui.emptyState, ui.loadingState, ui.errorState

```ts
ui.emptyState(el, 'Nothing here yet.');
ui.loadingState(el);                       // "Loading…" with a spinner
const up = ui.loadingState(el, 'Uploading', { progress: 0 }); // a progress bar instead
up.setProgress(0.4);                        // 0 to 1; setProgress(undefined) goes back to the spinner
ui.errorState(el, 'Could not load.', retry); // adds a "Try again" button when retry is given
ui.emptyState(el, 'No accounts yet.', { variant: 'inline' });
ui.errorState(el, 'Could not connect.', retry, { variant: 'inline', retryLabel: 'Reconnect' });
```

`variant` says where the state sits:

| Variant | Looks like | Use it in |
| --- | --- | --- |
| `centered` (default) | Centred, with padding | A page or a large panel |
| `inline` | A left-aligned description line (the empty state also carries Obsidian's `setting-item-description`) | A settings list |
| `pane` | Left-aligned, small (the empty state also carries Obsidian's `pane-empty`) | A sidebar pane |

### ui.badge, ui.statusDot, ui.statusText

```ts
ui.badge(el, 'Beta', 'accent');
ui.statusDot(el, 'success', 'Connected');  // the label is read by screen readers
ui.statusDot(el, 'warning', 'Waiting for you', { pulse: true });
ui.statusText(el, 'Not signed in', 'danger');
```

Tones: `default`, `accent`, `danger`, `success`, `warning`. The element `statusText` returns also has `setTone(tone)`, for a status that changes (set its text with `setText`). `pulse` makes a dot blink slowly (not when the system asks for reduced motion); keep it for something waiting on the user.

Status text in a status bar item (`ui.statusText(this.addStatusBarItem(), '')`) takes the status bar's font size and tabular figures, so a countdown does not shift as it ticks; a plugin needs no CSS for it.

### ui.avatar

```ts
ui.avatar(el, { text: 'Ada Lovelace' });           // reads "AL", announced as "Ada Lovelace"
ui.avatar(el, { text: 'CC', size: 'small' });      // initials as given
```

A person or an agent as initials in a circle. `size` is `small` (20px), `medium` (28px, the default) or `large` (40px). A name is cut to the first and last word's initial; one word of one or two characters, or a count such as `+12`, is shown whole, a longer word by its first character; letters are drawn in capitals; empty text reads `?`. The whole text is the avatar's accessible name and tooltip, so pass the full name when you have it.

### ui.swatch

```ts
ui.swatch(td, { kind: 'color', value: 'var(--color-red)', label: '--color-red' });
ui.swatch(td, { kind: 'radius', value: 'var(--radius-m)', label: '--radius-m' });
ui.swatch(td, { kind: 'size', value: '12px', label: '--size-4-3' });          // a bar that long
ui.swatch(td, { kind: 'font-weight', value: '700', label: '--font-bold' });   // "Aa" at that weight
```

One CSS value on show, for a token table or a theme picker. `kind` is `color` (any background, so a gradient too), `radius`, `shadow`, `size`, `font-family`, `font-size` or `font-weight`; `value` is written out or a `var(--token)`, and one CSS cannot read draws nothing (a font kind still shows plain "Aa"). A swatch is a 28px square, a `size` a bar on a 64px track (a longer length fills it), a font "Aa" in a 40px box that clips a very large size. `label` is its accessible name; the tooltip is the value, or `title`. Returns the element.

### ui.pickerGrid

```ts
const colors = ui.pickerGrid(el, {
  label: 'Colour',
  options: [{ value: 'red', label: 'Red', color: 'var(--color-red)' }, { value: 'blue', label: 'Blue', color: 'var(--color-blue)' }],
  value: 'blue',
  onChange: (v) => paint(v),
});
ui.pickerGrid(el, { label: 'Icon', options: [{ value: 'home', label: 'Home', icon: 'home' }, { value: 'code', label: 'Code', icon: 'code' }], onChange: (v) => use(v) });
colors.setValue('red'); // no onChange
```

One icon or colour picked from a grid. Each option has a `value`, a `label` (the cell's accessible name and tooltip) and an `icon` (a Lucide name) or a `color` (any CSS background, drawn as a round dot). It is a radio group with one Tab stop (the checked cell, else the first): Left and Right move and pick, wrapping; Up and Down move a row, wrapping too; Home and End jump to the first and last cell; a click picks. `onChange` gets the new value and is not called for the cell already checked. `value` may be left out (nothing checked); values are compared with `===`. `label` names the group; in a `ui.field` control the field's label does. The handle has `el` and `setValue`. For a few text choices use `ui.segmented`; for rows with details, `ui.choiceList`.

### ui.meter

```ts
ui.meter(el, { label: 'Context', value: 20, text: '40k / 200k', tone: 'success' });
ui.meter(el, { label: '5h', value: 95, text: '95%', tone: 'danger', title: 'Resets at 14:00' });
ui.meter(el, { label: 'Context', text: '40k' }); // no value: no bar
ui.meter(el, { layout: 'stacked', label: 'Weekly', value: 75, text: '75% used', sub: 'resets in 3d', tone: 'warning' });
ui.meter(td, { layout: 'bar', label: 'llama3', value: 40, tone: 'accent' }); // only the bar
```

How full something is: a quota, a budget, a context window. `value` is 0 to 100 (clamped); `tone` colours the fill (`default` is muted). `layout` is `inline` (the default: the label, a short bar, the reading on one line), `stacked` (label and reading above a full-width bar) or `bar` (only the full-width bar, for a table cell). `sub` adds a faint line under an inline or stacked meter. With a value the bar is a `progressbar` for screen readers, named by the label and read as the `text`; without one there is no bar, only the words (a `bar` with no value draws nothing). Returns the element. It does not update: redraw it when the reading changes. For work in progress use `ui.loadingState` with `progress`.

### ui.board

```ts
el.addClass('hel-board-page'); // the container fills the pane; the board takes what is left
const b = ui.board(el, { label: 'Tickets', onDragStart: () => hold(), onDragEnd: () => release(), onDrop: (id, lane, index) => move(id, lane, index) });
const todo = b.lane({ id: 'todo', label: 'To do' });
ui.statusText(todo.head, 'To do');
ui.badge(todo.head, '1');
const c = todo.card({ id: 'T-1', title: 'Fix the login', tone: 'warning', onOpen: () => open('T-1') });
ui.badge(c.meta, 'P1', 'warning');
ui.chip(c.meta, 'Needs your reply', { tone: 'warning' });

const done = b.lane({ id: 'done', label: 'Done', title: 'Done', onTitleClick: () => rename('done') });
const d = done.card({ id: 'T-2', check: { checked: true, label: 'Mark as not done', onToggle: (checked) => setDone('T-2', checked) } });
await MarkdownRenderer.render(app, text, d.content, path, component);
ui.moreButton(d.actions, () => cardItems('T-2'), 'Card options');
ui.button(done.footer, { text: 'Add a card', icon: 'plus', variant: 'link', onClick: () => add('done') });
```

A kanban board: a fixed-height row of lanes that scrolls sideways, each lane with a head slot and its own scrolling list. `lane()` returns `{ el, head, list, footer, card }`; `card()` returns a `ui.card` handle (compact; `body`, `footer`, `setTone`) with `content`, `actions` and `meta`. Draw an empty state or a "Load more" button into `list`.

A lane's `title` is drawn first in its head and wraps when long; `onTitleClick` makes it a button. Draw a count and a menu button (class `hel-toolbar-end` for the far end) into `head` after it. The lane's `footer` is for an "Add a card" button: it sits under the cards of a short list and stays in view under a long one.

A card has a row for what it says: `check` draws a done checkbox (`checked`, its accessible `label`, `onToggle(checked)`), `content` takes text or rendered markdown with the margins at its edges trimmed, and `actions` holds buttons at the far end. The checkbox and actions stay level with the first line. `meta` is a wrapping row for chips and badges under it. Like a drop, a tick only reports: change your data and redraw.

With `onDrop` the cards can be dragged (`draggable: false` keeps one still). The board outlines the lane under the pointer, dims the dragged card, and reports a drop as the card's id, the lane's id and the place: before the first of that lane's cards whose middle is below the pointer, not counting the dragged one (the top for a drop on the lane's head, the end for one on its footer). It does not move anything itself: change your data and redraw. A redraw during a drag would take the card away, so hold redraws from `onDragStart` until `onDragEnd`, which runs once per drag, before `onDrop`. Dragging has no keyboard equivalent, so offer another way to move a card (its `onOpen` view, a menu).

`onOpen` makes the card a button, opened by a click, Enter or Space (not by the buttons and links inside it); `label` names it when the title is not enough.

### ui.barChart

```ts
ui.barChart(el, {
  label: 'Cost per day',
  buckets: [
    { key: '2026-11-24', value: 1.2, title: '2026-11-24: $1.20' },
    { key: '2026-11-25', value: 0, title: '2026-11-25: no calls' },
  ],
});
```

A column chart: one column per bucket, in the order given, scaled to the largest value. A non-zero bucket always shows (at least 2px tall); zero, negative or non-finite values draw no bar. `title` is the column's tooltip and `key` its `data-key`; the first and last `key` are written under the baseline. `label` names the chart for screen readers (it is an `img`, so the columns are not read: put the figures that matter in text or a `ui.table` beside it). Returns the element. It does not update: redraw it when the data changes.

A sortable table: mark columns `sortable`, pass `sort: { key, dir }` and `onSort(key)`; you sort the rows and redraw (or `setSort` and `setRows`). `fixed` with a `width` on each column keeps columns still as rows change, `minWidth` scrolls the table sideways in a narrow pane, `align: 'end'` is for numbers, `truncate` cuts a long column. `rowLevel` with a `tree` column draws a tree, and `rowMuted` dims rows. A bar chart's `onSelect` makes each column with a value a button, `labels: 'all'` names every column and a bucket's `muted` marks one not reached yet.

### ui.artwork, ui.mediaGrid, ui.mediaCard

```ts
const grid = ui.mediaGrid(el);                       // or { layout: 'strip', minWidth: 120 }
const card = ui.mediaCard(grid, { art: { title: 'Heat', src: posterUrl, onClick: open }, title: 'Heat' });
ui.rating(card.body, { value: 4.5 });
ui.button(card.footer, { text: 'Search', onClick: search });
```

Things with artwork: films, books, albums. `artwork` draws the 2:3 picture alone (the title when there is no `src`; in an app frame the URL must be in the app's `net` origins). A `mediaCard` is a card led by one: `layout: 'row'` for search results, `plain` without a ring, `selected` while something is open for it, `focused` for a card a link led to. It returns the card handle plus `art`.

### ui.figures, ui.rating, ui.statTiles

`figures(el, [{ text, label, icon, onClick }], { columns: 2 })` draws small figures such as ratings, each with a Lucide icon name or a node, linked when it has `onClick`. `rating(el, { value, max })` is a read-only star rating. `statTiles(el, [{ value, label, title, onClick }])` is a row of headline numbers.

### ui.sectionHeading

`sectionHeading(el, { title, extra, level })` draws a page (1), section (2) or part (3) title and returns `{ el, titleEl, actions }`; draw buttons into `actions`.

### ui.monthGrid

```ts
ui.monthGrid(el, { month: new Date(), events: (day) => byDay.get(day) ?? [], max: 3 });  // day is "YYYY-MM-DD"
```

A month in a week grid. Each event is `{ title, lead, tooltip, onClick }`. Days are all the same height; a day with more than `max` events shows "+N more", which opens them all in a popover. It does not move between months by itself: redraw it from your own buttons.

### ui.countBadge

```ts
const unread = ui.countBadge(tabHeader, 3, { label: 'unread' }); // read as "3 unread"
unread.set(0);  // hidden at 0
unread.set(12); // "9+": above `max` (default 9) it shows max and a plus
```

It is a `role="status"` live region: screen readers hear the exact count with the label ("12 unread"), not "9+".

`pulse: true` blinks it like a pulsing dot. `tone` is `accent` (the default) for a plain count, or `danger` / `warning` for one that wants attention, such as questions waiting on the user. `overlay: true` lays the badge over the parent's top-right corner instead of in the flow (the parent becomes `position: relative`), for a count on an icon such as a ribbon button: the icon stays where it was and the badge takes no clicks. `icon` puts an icon before the number:

```ts
ui.countBadge(row, 2, { tone: 'danger', icon: 'circle-help', label: 'waiting' }); // "2 waiting" with a question mark
```

### ui.chip

```ts
ui.chip(el, 'project');
ui.chip(el, 'draft', { tone: 'accent', title: 'Status', onRemove: () => removeTag('draft') });
ui.chip(el, 'Reading list', { icon: 'file-text' });
```

A tag-like label. `icon` draws a decorative icon before the text, the size of it. With `onRemove` it has an × button; a click removes the chip from the page and then calls `onRemove`.

### ui.field and the input parts

`ui.field` draws a label, a slot for one control (`control`), an optional hint and an error line. An input part drawn into `control` is named by the label and described by the hint, so it needs no `label` of its own.

```ts
const name = ui.field(el, { label: 'Name', hint: 'Shown in the sidebar.' });
ui.textInput(name.control, { value: note.name, onInput: (v) => name.setError(v.trim() ? null : 'Enter a name.') });

const kind = ui.field(el, { label: 'Kind', inline: true });              // label and control on one row
const path = ui.field(el, { label: 'Location', fill: true });             // the control takes the full width
const pick = ui.dropdown(kind.control, { options: [{ value: 'local', text: 'Local' }, { value: 'synced', text: 'Synced' }], value: 'local', onChange: setKind });

const sync = ui.toggle(el, { value: true, label: 'Sync this vault', onChange: setSync });
ui.textInput(el, { secret: true, label: 'API key', onEnter: save });  // a password input
ui.slider(el, { min: 10, max: 30, value: 16, label: 'Font size', onChange: setSize });
ui.searchInput(el, { placeholder: 'Filter plugins', onSearch: (q) => filter(q) });
```

| Part | Returns | Notes |
| --- | --- | --- |
| `field(parent, { label, hint?, inline?, fill? })` | `{ el, control, setError(msg \| null), setHint(text) }` | A control keeps its own width unless `fill: true`: then a text box, dropdown or search box fills the slot (sharing the row with a button drawn beside it), and a multiline box, choice list, check list or picker grid gets a row of its own. Use it for paths, links and lists. `setError` shows the message and marks the control invalid; `null` clears it. `setHint` changes the hint (adding one if the field had none). |
| `textInput(parent, { value?, placeholder?, secret?, type?, label?, onInput?, onEnter?, multiline?, rows? })` | the `<input>` (a `<textarea>` with `multiline`) | `type` is `text` (default) or `number`; `secret` hides the text. `multiline: true` makes a box of several lines (`rows`, default 3) for a longer answer; Enter starts a new line there and `onEnter` is not called. |
| `toggle(parent, { value, label, disabled?, hideLabel?, onChange? })` | `{ el, setValue, setDisabled }` | Obsidian's switch (`checkbox-container`) with its label; Space and Enter flip it. `setValue` does not call `onChange`. `hideLabel` keeps the label as the switch's accessible name without showing it, for a row that shows the name elsewhere. |
| `dropdown(parent, { options: [{ value, text }], value?, label?, compact?, onChange? })` | `{ el, setValue, setDisabled }` | Obsidian's `dropdown`. `compact` is shorter, for toolbars and rows. |
| `slider(parent, { min, max, step?, value, label, onChange })` | the `<input type="range">` | `onChange` runs as it moves. |
| `searchInput(parent, { placeholder?, value?, delayMs?, onSearch })` | the `<input>` | In Obsidian's `search-input-container`, with a clear button (a keyboard button too). Typing waits `delayMs` (120) before `onSearch`; Enter, the clear button and Escape (which empties the box) search at once. |

`label` on an input part is its accessible name when there is no visible label; give one whenever the part is not in a field.

### ui.tabs, ui.toolbar

```ts
const t = ui.tabs(el, {
  tabs: [{ id: 'installed', text: 'Installed', badge: 12 }, { id: 'browse', text: 'Browse' }],
  value: 'installed',
  onSelect: (id) => drawPanel(id),
});
t.setBadge('installed', 11);   // 0 hides it
t.setValue('browse');          // moves the selection without calling onSelect

const bar = ui.toolbar(el, { label: 'Filters' });  // a role=toolbar row; draw controls into it
ui.searchInput(bar, { onSearch: filter });
ui.button(bar, { text: 'Refresh', onClick: reload });
```

Tabs follow the WAI-ARIA tabs pattern: the arrow keys, Home and End move between tabs. You draw the panel in `onSelect`.

### ui.callout

```ts
ui.callout(el, { tone: 'accent', text: '2 questions are waiting.', action: { text: 'Answer now', onClick: openInbox } });
const err = ui.callout(el, { tone: 'danger', text: '', live: true });
err.hide();
// later
err.setText('Could not create the vault.'); err.show();
```

A banner or an inline message. Tones: `info` (default), `accent`, `warning`, `danger`, `success`. `text` is a string or a `DocumentFragment`. `action` takes `ui.button`'s options and draws a button after the text. `solid: true` fills the banner with the tone's colour (on-accent text, a contrasting action button), for something that must not be missed, such as an agent waiting on the user. `live: true` has screen readers read the text when it changes; use it for an error or status line that updates. The handle has `setText`, `setTone`, `setAction` (replaces the action button; `null` removes it), `hide` and `show`. It is also Obsidian's `callout`, so a theme's callout colours apply.

### ui.card

```ts
const c = ui.card(el, { title: 'Claude Code', icon: 'terminal' });
ui.statusText(c.body, 'Signed in', 'success');
c.setTone('warning');
```

A bordered block with a head (icon and title; hidden when there is neither) and a `body` you draw into. Add actions or a status to `head`. Tones: `default`, `accent`, `warning`, `muted` (a finished or inactive item). `compact` has less padding.

`attention: true` is for a card that waits on the user, such as an agent's question: a thick border and a tint in its tone (`accent`, or `warning` for a permission), the icon in the tone's colour, the interface font at a readable size (set on the card, so a terminal or editor font around it never leaks in; code inside stays monospace), roomier choice-list rows with a tinted pick and key hints in muted text that brighten when a row is hovered, focused or picked, and a focus ring while focus is inside. `sticky: true` keeps it at the top of its scrolling pane, raised by a shadow. The handle's `titleEl` is the title element (null without a title); `pulse()` pulses the outline a few times to draw the eye (nothing moves under reduced motion), and `setBusy(true)` dims the card and ignores the pointer while something it started runs.

### ui.popover

```ts
const p = ui.popover(button, { title: 'Rename branch', onClose: (why) => remember(why) });
const name = ui.textInput(p.body, { value: 'main' });
ui.button(p.footer, { text: 'Rename', variant: 'primary', onClick: () => { rename(name.value); p.close(); } });
```

A floating panel at an anchor, for a short question or detail about one thing on screen. It does not block the page; use `ui.dialog` when the user must answer before going on. The first argument is where it opens: an element, a point (`{ x, y }`), a rectangle such as a caret's (`{ left, right, top, bottom }`), or `null` for the middle of the window. It opens under the anchor (`side: 'top'` for above) with their left edges aligned, and stays inside the window: it flips to the other side or the anchor's other edge when it has no room, and its body scrolls when the window is too short. It follows its content, window resizes and, with an element anchor, scrolling (a point or rectangle stays where it was given); call `update()` after an element anchor moves some other way.

Options: `title`, `icon`, `label` (its accessible name when there is no title), `quote` (what it is about, such as the selected text: a `<blockquote>` first in the body, as written), `side`, `width` (px, 320), `returnFocus`, `document` (to draw a point in another window) and `onClose`. The handle has `el`, `head`, `body`, `footer` (hidden while empty), `titleEl`, `update` and `close`.

Focus moves into it (to its first control, unless you focus one yourself). Escape, a click outside it and `close()` close it, and focus goes back to `returnFocus`, or to what had it before, unless the user has moved it elsewhere. Clicks on its anchor, a menu or a suggestion list do not count as outside, so an anchor button decides itself what a second click does. One popover is open at a time. `onClose` gets why: `'escape'`, `'outside'` or `'close'`.

### ui.disclosure

```ts
const step = ui.disclosure(el, { title: 'Which sync service?', compact: true, onToggle: (open) => step.setOpen(open) });
ui.badge(step.lead, '1', 'accent');
ui.chip(step.lead, 'Sync');
ui.choiceList(step.body, { label: 'Sync service', options: [{ value: 'iCloud', text: 'iCloud' }, { value: 'Dropbox', text: 'Dropbox' }], onChange: (v) => step.setSummary(v) });
```

A card whose head opens and closes its body: one step of an accordion, or details most people do not need. It takes `ui.card`'s options (`title` is required) and returns its handle, plus `lead` (badges and chips before the title), `peek` (content that stays on show while closed), `summaryEl`, `setSummary(text)` and `setOpen(open)`. It starts closed unless `open: true`. A click on the head, or Enter or Space while it has focus, asks for the other state: with `onToggle` the card waits for your `setOpen` (so you can keep one step open at a time), without it the card opens and closes itself. A button, link or form control inside the head keeps its own click. The title wraps; `summary` is one line, shown only while closed.

### ui.checkList, ui.choiceList

```ts
const scopes = ui.field(el, { label: 'Capabilities' });
const caps = ui.checkList(scopes.control, {
  options: [{ value: 'mail', text: 'Mail', detail: 'Read and send mail' }, { value: 'calendar', text: 'Calendar' }],
  value: ['mail'],
  onChange: (v) => save(v),   // ['mail', 'calendar'], in option order
});
caps.value(); caps.setValue([]);

ui.choiceList(el, {
  label: 'Harness',
  options: [{ value: 'claude', text: 'Claude Code', detail: 'Runs in a terminal', icon: 'terminal', tag: 'Recommended', key: '1' }, { value: 'codex', text: 'Codex', key: '2' }],
  value: 'claude',
  onChange: (v) => pick(v),
});
```

`checkList` is a group of checkboxes, each with an optional `detail` line and `disabled`. In a field, the field's label names the group; otherwise pass `label`. `setValue` does not call `onChange`.

In a field, the field's label names a `choiceList` or a `segmented` too. `choiceList` is a list of option rows to pick from inline: one (`onChange` gets the value) or, with `multi: true`, any number (`onChange` gets the values in option order). A row can have a `detail`, `icon`, `tag` and `key`; the arrow keys move between rows, Enter or Space picks, and an option's `key` picks it while the list has focus. `ui.choose` draws its rows with it. The handle has `setValue`, which does not call `onChange`. `indicator: 'radio'` (or `'check'` for a multi list) draws a radio dot or a checkbox before each row, for a list whose pick is a setting rather than an action (the default, `'none'`, suits a list where a pick acts at once, as in `ui.choose`). An option's `preview` draws more about it under its detail (a rendered example of what it would make), inside the row, so it must hold nothing to act on. An option's `badge` (`{ text, tone }`) goes at the end of its row; its `trailing` draws something to act on (a link) in a slot beside the option, outside it, so Tab reaches it and it is not read as part of the option.

### ui.listRow, ui.listGroup

```ts
const today = ui.listGroup(paneEl, { title: 'Today', count: 3, collapsed: false, onToggle: (c) => remember(c) });
ui.listRow(today.body, {
  title: 'Fix the build', meta: '2m', active: true,
  dot: { tone: 'warning', label: 'Waiting for you', pulse: true },
  actions: [{ icon: 'play', label: 'Resume', onClick: resume }],
  onClick: (e) => open(e),
  menu: () => [{ title: 'Rename', onClick: rename }, 'separator', { title: 'Delete', danger: true, onClick: del }],
});
ui.listRow(today.body, {
  title: 'Keep the sidebar width', sub: '#42 · ana · main', tag: 'Draft',
  status: { text: 'Failing', tone: 'danger', title: '1 of 4 checks failed' },
  chips: ['bug', { text: 'urgent', tone: 'danger' }],
});
ui.emptyState(paneEl, 'No open chats.', { variant: 'pane' });
```

Rows for a sidebar pane list. A row has a title and optionally an `icon`, a status `dot`, a `tag`, a toned `status` badge with words (`{ text, tone, title }`; `title` is the tooltip), a line of tag `chips` under the row (strings or `{ text, tone, title }`; they share one line, and five or more show three and a "+N" naming the rest in its tooltip), a count `badge` (`{ count, ...countBadge options }`, before the meta), faint `meta` text (at most half the row; a longer one ends in an ellipsis, so put what matters first), a faint second line `sub` (the row's two-line form; see `ui.densityAction`) and icon `actions` (shown on hover, focus, or when the row is `active`; an action's `id` becomes its `data-action`). With `onClick` the row can be focused and Enter runs it. `menu` is built fresh on each right-click and opens like `ui.menu`. `obsidianClass: 'tree-item'` also gives the row Obsidian's file-tree classes (`tree-item-self nav-file-title`), so a theme's file-tree look applies; `'nav-file-title'` gives only the `nav-file-*` ones, in a `nav-file` wrapper as Obsidian draws a file row. `listRow` returns the row.

`listGroup` is a collapsible group: a header with a chevron, the title and an optional `count`, and a `body` to put the rows in. Clicking the header (or Enter) toggles it and calls `onToggle` with the new state. Use `emptyState` with `variant: 'pane'` when a pane has no rows.

### ui.composer

```ts
const box = ui.composer(el, {
  placeholder: 'Ask anything', hint: 'Enter sends, Shift+Enter starts a new line.',
  onSubmit: async (text) => { await send(text); },
});
box.focus();
```

A text box with a send button. `submitOn: 'enter'` (default) sends on Enter; `'mod-enter'` sends on Cmd/Ctrl+Enter and leaves Enter for new lines. Blank text is not sent. When `onSubmit` returns a promise, the composer is busy until it settles. The box is cleared once `onSubmit` returns or its promise resolves; when it throws or rejects, or returns (or resolves to) `false` because nothing was sent, the text stays. An IME's Enter never sends. `allowEmpty: true` sends an empty box too, for a send button that starts something whose text is optional. Other options: `rows` (3), `submitLabel` ("Send"), `submitIcon` (an icon button instead of a text one). The handle has `input`, `setBusy`, `focus` and `clear`.

`createInput: (parent) => field` puts another text box in place of the textarea, such as a markdown editor. The callback appends it to `parent` and returns the element that has `value`, `readOnly`, `selectionStart` and `setSelectionRange` and fires `input` and `keydown`. What it appended is drawn as the box (`hel-composer-host`): the textarea's rings and text, at least `rows` lines tall and scrolling past `--hel-composer-max-height` (320px), with a CodeMirror editor's own box reset and image embeds as `--hel-composer-thumb-size` (52px) thumbnails. Showing a placeholder is the caller's job, and so is keeping an editor from inserting a line on the Enter that sends.

`slashCommands: () => [{ name, description? }]` (or a promise of them) turns on a "/" menu: typing "/" at the start of the box lists the commands in a popup (above the box, or below when there is more room there), filtered as you type. Arrow keys move, Enter or Tab inserts `/name ` (it never sends), Escape closes, and a click picks. The function is called once, the first time the menu opens.

### ui.codeBlock

```ts
const code = ui.codeBlock(el, "ui.button(el, { text: 'Save' });", { label: 'Example' });
code.textContent = next;
```

Source code as written: a `<pre>` in the monospace font that never wraps (a long line scrolls sideways) and can be selected; the keyboard can focus it to scroll. The text is never read as HTML. `label` is its accessible name ("Code" by default). Set `textContent` to change what it shows. To cap a long file, give it a `max-height`, and it scrolls both ways.

### ui.keyValue

```ts
ui.keyValue(el, [
  { key: 'Name', value: 'Letterboxd' },
  { key: 'Connect to', value: hosts, isNew: (h) => !before.includes(h) },
  { key: 'Secrets', value: [], empty: 'None' },
]);
```

A definition list. A value is text, a list of strings (drawn as a list; `isNew` marks items with a "new" badge, accent or, with `newTone: 'warning'`, warning for something to look at twice such as an added permission), or a node drawn as given. An empty string or list shows `empty` ("None" by default).

### ui.thread, ui.threadText

```ts
const talk = ui.thread(el);
talk.event('Nov 25, 4:11 PM · Started a session');
const asked = talk.entry();
ui.threadText(ui.card(asked.el, { compact: true, title: 'Agent', icon: 'bot' }).body, 'Which branch?\nmain or next?');
const answer = asked.replies().entry();
ui.threadText(ui.card(answer.el, { compact: true, title: 'You', icon: 'user', tone: 'accent' }).body, 'main');
```

A threaded conversation. `entry()` adds a comment: draw its `ui.card` into the entry's `el`. `replies()` is the list under that entry (the same kind of list, added on the first call after what the entry then holds), indented along a rail. Past `maxIndent` levels (default 3) a replies list stays level with the one above. `event(text)` adds a muted line for something that happened. Anything else, such as a callout or a `ui.composer` for a reply, goes into a list's `el`. `ui.threadText(parent, text)` draws text as written, never as markup: line breaks are kept and long words wrap. The thread does not update itself: empty the container and redraw it.

### ui.confirm, ui.prompt, ui.choose, ui.form

Each takes the app first and returns a promise. A cancel (Cancel button, Escape, click on the backdrop) resolves to `false` for `confirm` and `null` for the others.

```ts
const ok = await ui.confirm(app, { title: 'Discard changes', message: 'Discard the changes to this note?', action: 'Discard', danger: true });
const name = await ui.prompt(app, { title: 'Rename note', label: 'Name', value: note.name, action: 'Rename', validate: (v) => (v.trim() ? null : 'Enter a name.') });
const pick = await ui.choose(app, { title: 'Pick a template', options: [{ value: 'blank', text: 'Blank', detail: 'An empty note', icon: 'file' }] });
const v = await ui.form(app, { title: 'Add a vault', action: 'Add vault', fields: [{ id: 'path', kind: 'text', label: 'Path' }, { id: 'sync', kind: 'checkbox', label: 'Sync it' }] });
```

To run the work inside the modal, pass `onConfirm` (confirm) or `onSubmit` (form, which gets the values). The modal stays open while it runs: the action button shows busy, the other buttons are disabled, and every way of closing it (Cancel, Escape, the backdrop, the close button) does nothing until the work settles. So an `onConfirm` that never settles keeps the modal open for good; give network calls a timeout. When it returns, the modal closes and resolves as usual (`true`, or the values). When it throws, its message is shown above the buttons, the buttons work again, and the modal stays open for a retry or a cancel. A form's `message` is a paragraph above its fields.

```ts
await ui.confirm(app, { title: 'Remove account', message: 'Remove the AWS account?', action: 'Remove', danger: true, onConfirm: () => api.remove(id) });
await ui.form(app, { title: 'Repair access', action: 'Repair', message: 'Asks AWS for the missing permissions.', fields, onSubmit: (v) => api.repair(v) });
```

A `choose` option can have a `detail` line and an `icon`. In `confirm`, `prompt` and `form`, Cancel's button is `data-action="cancel"` and the action button `data-action="action"`, for tests.

Form fields (`Field`) are `text` (with `placeholder`, `secret`), `checkbox` (with an optional `detail` line), `select`, `choice` (one of a list of rows) and `multi` (a check list: any number of `options`, each with an optional `detail` and `disabled`). Each field's row carries its `id` as `data-field`, for tests. The form resolves to an object keyed by field `id` (`FieldValues`): strings, booleans, and a string array for a `multi` field.

### ui.dialog

```ts
const account = await ui.dialog<Account>(app, {
  title: 'Connect account', width: 'wide',
  render: (body, ctx) => { drawFields(body); return () => stopPolling(); },  // the cleanup runs when it closes
  actions: [{ text: 'Connect', variant: 'primary', onClick: async (ctx) => ctx.close(await api.connect(read())) }],
});
```

A modal with a body you draw. `icon` puts an icon before the title. `render` gets the body and a context; `actions` are the buttons after Cancel (`cancel` sets Cancel's text, `false` leaves it out). An action's `id` becomes its button's `data-action` (Cancel's is `cancel`), for tests. `focus` names the button that has focus when it opens (`'cancel'` or an action's `id`), for a prompt where Enter alone must not run the main action. An action closes the dialog by calling `ctx.close(value)`; the dialog resolves to that value, or `null` on a cancel (Cancel, Escape, the backdrop). An action that returns a promise keeps the dialog busy until it settles; one that throws shows its message above the buttons and leaves the dialog open. While busy, every way of closing it (Cancel, Escape, the backdrop, the close button) does nothing, so an action that never settles keeps the dialog open; only `ctx.close` still closes it. `ctx.setBusy` and `ctx.setError` do the same by hand (`ctx.setBusy(true)` blocks closing the same way until `ctx.setBusy(false)`). `ctx.button(id)` returns a button's handle (`'cancel'` for Cancel), for a dialog with steps whose buttons change: `setText`, `setDisabled` (it stays disabled after the dialog is busy), or `el.hidden` to hide it. `width: 'wide'` gives a wider modal. `doc` opens the dialog in another document (a popout's, or the Settings window's); pass the owner document of the element the user clicked.

For content with its properties beside it (an issue page), call `ctx.sidePanel()` in `render`: it adds two columns to the body and returns them as `{ main, side }`, the side one on the right behind a hairline. A narrow dialog stacks them, content first. Later calls return the same two. Use it with `width: 'wide'`.

```ts
ui.dialog(app, {
  title: 'Edit ticket', width: 'wide',
  render: (body, ctx) => {
    const { main, side } = ctx.sidePanel();
    ui.textInput(ui.field(main, { label: 'Title' }).control, { value: t.title });
    ui.keyValue(side, [{ key: 'Assignee', value: t.agent }]);
  },
});
```

### ui.menu, ui.moreButton, ui.menuButton

```ts
ui.menu([{ title: 'Rename', icon: 'pencil', onClick: rename }, 'separator', { title: 'Delete', icon: 'trash-2', danger: true, onClick: del }], event);
ui.menu([{ title: 'Date', checked: true, onClick: byDate }, { title: 'Folder', checked: false, onClick: byFolder }], event, { doc: el.ownerDocument });
ui.moreButton(el, () => [{ title: 'Rename', onClick: rename }]);  // "..." icon button; the list is built each time it opens
ui.menuButton(el, { text: 'Add permission…', items: () => addable.map((c) => ({ title: c, onClick: () => add(c) })) });
```

`ui.menu` opens at a mouse event or an `{ x, y }` point, in the event's document (else the active one); `doc` names the document to draw in, for a popout or the Settings window. `onHide` runs when the menu closes, however it closes (before a chosen item's `onClick`). It returns a handle with the menu's `el` and `hide()`. An item can be `checked` (a check mark; `false` marks an option that is off) and have a `tooltip`. Both are host-only: a vault app's bridge menu (`@helenite/ui-kit`) ignores them. `moreButton` and `menuButton` open their menu under the button, in the button's document. `menuButton` is a text button (`variant` as for `ui.button`).

### ui.notice

```ts
ui.notice('Imported 12 notes', { kind: 'success' });  // kind: info (default), success, error; timeoutMs optional
const n = ui.notice('2 items need review.', { timeoutMs: 0, action: { text: 'Review', onClick: openReview } });
n.setText('3 items need review.');
n.hide();
```

It returns a handle with `setText` and `hide`. `action` adds a button after the text; a click runs it and hides the notice. `onClick` runs when the notice itself is clicked (a click always hides it). `timeoutMs: 0` keeps it until then.

### ui.paneHeader

```ts
ui.paneHeader(this.contentEl, [
  { icon: 'list-tree', label: 'Group by', id: 'group-by', onClick: (e) => ui.menu(groupItems(), e) },
  { icon: 'plus', label: 'New chat', onClick: newChat },
]);
```

The row of icon buttons at the top of a sidebar pane. It is Obsidian's `nav-header` with `nav-action-button`s, so a theme's look applies. It puts itself first in the element and returns the header. `label` is each button's accessible name; `id` becomes its `data-action`.

### ui.densityAction

```ts
ui.paneHeader(this.contentEl, [
  ui.densityAction(settings.density, (d) => { settings.density = d; save(); this.rebuildHeader(); this.render(); }),
]);
```

The pane-header button for lists that can show one line per row (`'compact'`) or two (`'detailed'`). It returns a `paneHeader` action (`data-action="density"`) whose icon and label name the mode a click switches to, and calls `onChange` with that mode. Keep the choice in the plugin's data, rebuild the header so the icon follows, and in `detailed` mode pass `ui.listRow` a `sub` line (details such as folder, model or worktree) instead of squeezing them into `meta`. Panes that list items should offer both.

### ui.action and ui.STANDARD_ACTIONS

A button with a fixed icon, label and variant for a common job. Use these instead of inventing your own.

```ts
ui.action(el, 'back', { onClick: goBack });
ui.action(cell, 'delete', { app, subject: 'Notes', onClick: remove }); // asks to confirm first
```

| Id | Look | Use it for |
| --- | --- | --- |
| `back` | Icon: chevron left | Leaving a sub-page |
| `close` | Icon: x | Closing a panel |
| `reset` | Link: Reset | Putting a setting back to how it started |
| `useDefault` | Link: Use Default | Dropping an override so the default applies |
| `editInHome` | Link: Edit in Home | Sending the user to where a Home setting lives |
| `configure` | Icon: settings | Opening a thing's options |
| `turnOff` | Icon: power | Disabling a thing without deleting it |
| `delete` | Danger: Delete | Removing a thing for good |
| `open` | Button: Open | Opening a thing elsewhere |
| `remove` | Danger: Remove | Taking a thing out of a list or off an account, when it is not destroyed |
| `add` | Primary: Add | Adding a new item |
| `moveUp` | Icon: arrow up | Moving an item up in an ordered list |
| `moveDown` | Icon: arrow down | Moving an item down |
| `reconnect` | Primary: Reconnect | Signing a connection in again |

`delete` and `remove` need `app` and `subject`, and always confirm with a danger modal: "Delete X? This cannot be undone." or "Remove X?". Only your `onClick` runs on a yes. Change the copy with `title`, `message` and `confirmText` (the modal's action button), for example a delete that moves to the trash: `{ title: 'Move Ideas.md to the trash', message: 'Move Ideas.md to the trash?', confirmText: 'Move to trash' }`.

`variant: 'icon'` draws any action as an icon button, with its label as the accessible name (a Reset beside a hotkey).

### ui.settings

```ts
const rows = ui.settings.section(containerEl, 'Items');          // heading + container; put rows in the container
ui.settings.section(containerEl, 'Secrets', { desc: 'Stored in the system keychain.' });  // a heading with a description
new ui.settings.row(rows).setName('Name').addText((t) => t.setValue(v));  // Obsidian's Setting
ui.settings.summaryRow(rows, { name: 'Sync', desc: 'On', onClick: openSync, chevron: true });
ui.settings.subpageRow(app, rows, { name: 'Items', desc: '3 items', title: 'Items', render: (page) => fill(page) });
ui.settings.scopeBar(containerEl, { editingDefaults: false, onChange: (d) => setScope(d) });
```

`subpageRow` opens a drill-in page with a Back button and fills it with `render` each time it opens. `openSubpage(app, title, render)` does the same without a row. `scopeBar` is the "Editing: Home / Vault Defaults" switch for a setting that has both layers.

```ts
const c = ui.settings.card(containerEl, { name: 'Claude Code', desc: 'claude', icon: 'terminal', status: { text: 'Installed', tone: 'success' } });
c.head.addDropdown((d) => d.addOption('a', 'A'));   // the head is a Setting
c.setStatus({ text: 'Not found on this computer', tone: 'warning' });
ui.settings.vaultScope(c.body, {
  value: policy, vaults: [{ id: 'work', name: 'Work' }, { id: 'old', name: 'Archive', disabled: 'Closed vault' }],
  homeNote: true, confirmAll: () => ui.confirm(app, { title: 'Allow all vaults', message: 'Let every vault use it?', action: 'Allow all' }),
  onChange: (v) => save(v),   // 'all' | 'none' | { only: ids } | { except: ids }
});
```

`card` is a bordered card for a settings tab: its `head` is a `Setting` with the icon, name, description and an optional status line (`setStatus(null)` removes it), and `body` is for more rows.

`vaultScope` is the row that says which vaults may use something: a dropdown of Allow all, Only these vaults, All except these vaults and Not available in vaults, and for a list, a check list of the vaults under it. `kinds` picks and orders the choices; add `'all-off'` to offer "Allow all, off by default" (every vault may use it, but it is off until a vault turns it on). The labels are fixed, so every page says the same thing. A new list starts from the vaults allowed today; from `'all-off'`, "Only these vaults" starts from the vaults marked `on: true` (where it is on today), so vaults where it is only off by default stay out. "Only these vaults" with nothing to list shows an empty list and calls `onChange` only once a vault is ticked. `confirmAll` is asked before Allow all, and a no puts the dropdown back. A vault's `disabled` is the reason it cannot be changed, shown under its name. `homeNote` adds "Home can always use it." above the list. `inline: true` draws the dropdown and the list straight into the element you pass (a table cell, or a card's `head.controlEl`) instead of in a settings row of its own; the handle's `row` is then `null`. `disabled` (and `setDisabled`) shows the scope without letting it change, for something that is always allowed. `setValue` shows a value without calling `onChange`; a value whose kind is not in `kinds` is ignored.

## Page spacing

```ts
const page = this.contentEl.createDiv({ cls: 'hel-page' }); // or this.contentEl.addClass('hel-page')
ui.card(page, { title: 'Reading list' });
ui.emptyState(page, 'Nothing here yet.');
```

A view's content has no padding of its own. `hel-page` pads it and keeps cards, disclosure cards, centered empty and error states, stat tiles and media grids from touching what is around them, in the page and in its `ui.settings.section`s. A view that is a board uses `hel-board-page` instead (see `ui.board`).

## Vault apps

Vault apps (the sandboxed micro-apps that live in the vault) get the same parts from the package `@helenite/ui-kit`, not from `helenite`:

```ts
import { button, segmented, table, emptyState, badge, statusDot, field, textInput, toggle, dropdown, tabs, callout, card, disclosure, listRow, mediaCard, cardGrid, picker, setBridge, confirm, prompt, choose, form, menu, notice } from '@helenite/ui-kit';
```

The parts that draw into the page (button, segmented, table, the states, badge, statusDot, statusText, countBadge, chip, avatar, swatch, pickerGrid, field and the input parts, tabs, toolbar, callout, card, disclosure, checkList, choiceList, listRow, listGroup, composer, keyValue, codeBlock, meter, board, barChart, artwork, mediaGrid, mediaCard, figures, rating, statTiles, sectionHeading, monthGrid) are the same functions as in `helenite`: they take the element and the same options as above, and work directly inside the app's frame. Every app frame loads the design-system stylesheet, which carries the button variants (primary, danger, icon) itself, so the parts look the same as in plugins without any CSS from the app. It also carries a copy of Obsidian's switch and input looks for the form controls, since a frame has no Obsidian stylesheet (the frame's base stylesheet styles `select`, so a dropdown keeps a plain select look there). Importing `@helenite/ui-kit` installs an icon renderer that takes any Lucide name and draws it as inline SVG. The standard action icons, `more-horizontal`, `chevron-right` and a few more (`check`, `plus`, `search`, `chevron-down`, and `align-justify` and `rows-2` for `densityAction`) are inside the kit and draw at once; the rest are asked of the host over the bridge (call `setBridge`) and draw when it answers, so an app does not bundle the icon set. A name the host does not know is only set as `data-icon` on the icon element. ui-kit's own parts (cardGrid, posterRow, picker and calendarStrip) also need `@helenite/ui-kit/ui-kit.css` in the app's `view.css`. Prefer `mediaGrid` and `mediaCard` for posters. For content a host modal cannot show (a table with its own buttons), `frameDialog({ label, onClose })` draws a large dialog in the frame: lift the frame with `api.ui.overlay(true)` while it is open.

An app that inherits the theme (the default) gets the host's resolved theme variables on its frame's `body`, so they match the host exactly, and the theme's and snippets' CSS restyle the parts (see [STYLING.md](./STYLING.md)). The frame's page background always stays transparent, whatever a theme or snippet paints on `html` or `body`; to paint a background, style an element inside the app.

Overlays take the same options as the plugin versions, minus `app`, and are drawn by the host through the capability bridge: the app sends a declarative spec, and the host draws it with `ui.dialog` or `ui.menu` over the whole window (a frame cannot draw outside itself) and sends back the answer. Connect the bridge first, with the `api` your app's default export receives. Without it, every overlay and `notice` throws:

```ts
export default (root, api) => {
  setBridge(api);
  // ...
};

const ok = await confirm({ title: 'Discard changes', message: 'Discard the changes to this note?', action: 'Discard', danger: true });
const name = await prompt({ title: 'Rename note', label: 'Name', value: note.name, action: 'Rename' });
const pick = await choose({ title: 'Pick a template', options: [{ value: 'blank', text: 'Blank' }] });
const v = await form({ title: 'Add a vault', action: 'Add vault', fields: [{ id: 'path', kind: 'text', label: 'Path' }] });
await menu([{ title: 'Rename', onClick: rename }], { x: e.clientX, y: e.clientY });
notice('Imported 12 notes');
```

The standard actions, the menu buttons and the pane header come from the kit too: `action(el, id, o)`, `moreButton(el, items, label?)`, `menuButton(el, { text, items })`, `paneHeader(contentEl, actions)` and `densityAction(density, onChange)`. They take the plugin versions' options without `app`; `delete` and `remove` still need a `subject` and ask through the bridge's `confirm`, and the menu buttons open a bridge menu under the button. `paneHeader`, `densityAction` and `STANDARD_ACTIONS` are the same functions and table as in `helenite`. Two families stay plugin-only: `ui.dialog` (a frame cannot draw its own content in a host modal; `confirm`, `prompt`, `choose`, `form` and `modal` cover what a spec can say) and `ui.settings.*` (built on Obsidian's `Setting` in the Settings window, which a frame has no part of).

Differences from the plugin versions: `prompt` has no `validate`, because a callback cannot cross the bridge. `choose` shows a list with a "Select" action, and no option icons. `menu` takes a point inside the frame. A `listRow`'s `menu` opens through the bridge as well, so it needs `setBridge` too.

An app's modal is never mistaken for one of Helenite's own prompts: the host puts the app's icon before the title and a "From <app name> · <app id>" line above the body, and the app has no way to style or place the modal (only `width: 'wide'`). A form field with `secret` is refused, since secrets are typed only into the host's own secret prompt (`promptSecret`). The host checks each spec (a title up to 120 characters, up to 20 body blocks, 20 fields and 3 actions besides Cancel, and up to 50 menu items) and rejects a bad one with `invalid-spec` (`secret-field` for a secret). An app has one modal open at a time (a second rejects with `modal-open`, and more than 5 in 10 seconds with `modal-rate`), its menus open over its own frame, and an open modal or menu closes, resolving as a cancel, when the view closes. `notice` honours `kind` and `timeoutMs`.

An app that draws its own modal instead, by lifting its frame over the whole window with `api.ui.overlay(true)`, is labelled too: the host draws a "From <app name> · <app id>" strip across the top of the window, above the frame and out of the app's reach, until the frame is put back. Prefer the overlays above, which look like the rest of Helenite.

### theme: isolate

By default an app inherits the user's theme and snippets (`theme: inherit`). To opt out, set it in `app.md`:

```yaml
theme: isolate
```

An isolated app still gets the theme's variables and the design-system stylesheet, but not the theme's or snippets' own CSS. Any value other than `inherit` or `isolate` is a manifest error.

## Which modal, which action

| You want to | Use |
| --- | --- |
| Ask yes or no | `ui.confirm` (`danger: true` when it destroys something) |
| Get one line of text | `ui.prompt` |
| Pick one of several named options | `ui.choose` (inline, without a modal: `ui.choiceList`) |
| Collect several values at once | `ui.form` |
| Show your own content, or several actions | `ui.dialog` |
| Tell the user something happened | `ui.notice`, not a modal |

Prefer a standard action (`ui.action`) to a hand-made button whenever one of the fourteen fits.

## Copy rules

- A modal's title is a verb phrase: "Rename note", "Add a vault", "Discard changes". Not "Confirm" or "Are you sure?".
- The action button repeats the verb: Rename, Add vault, Discard. Never "OK".
- Escape and a click on the backdrop mean cancel.
- Deleting always asks first, and the modal says it cannot be undone. Removing asks first too, without saying that.
- Use sentence case. Name the thing ("Delete Notes", not "Delete").
