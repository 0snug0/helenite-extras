# Helenite design system

Helenite gives plugins a set of ready-made UI parts (buttons, tables, modals, settings rows and so on) through a module named `helenite`. Use them instead of building your own: they look right in every theme and behave the same everywhere.

To see every part running, open **Settings, Design system**. Each part is shown live next to the code that makes it.

For restyling, see [STYLING.md](./STYLING.md). A working plugin is in `plugins/sample-design-system`.

## Types

The types live in the workspace package `@helenite/types`. It is private and not published to npm yet, so there is no `npm install` for it. In this repository, build it:

```
pnpm --filter @helenite/types build
```

That writes `packages/types/dist/helenite.d.ts`, a `declare module 'helenite'` file. Include it in your plugin's `tsconfig.json` (`"include": ["src", "<path>/helenite.d.ts"]`).

## Import

```ts
import { ui, version } from 'helenite';
```

`version` is the running Helenite version (`0.1.0` today). The public types are exported from the same module, type-only: `ButtonOptions`, `ButtonHandle`, `TableOptions`, `TableColumn`, `TableGroup`, `Field`, `Tone`, `StateVariant`, `ErrorStateOptions`, `CountBadgeOptions`, `CountBadgeHandle`, `ChipOptions`, `FieldOptions`, `FieldHandle`, `TextInputOptions`, `SearchInputOptions`, `SliderOptions`, `ToggleOptions`, `ToggleHandle`, `DropdownOptions`, `DropdownHandle`, `TabSpec`, `TabsOptions`, `TabsHandle`, `FieldValues`, `CalloutOptions`, `CalloutHandle`, `CalloutTone`, `CardOptions`, `CardHandle`, `CardTone`, `CheckOption`, `CheckListOptions`, `CheckListHandle`, `ChoiceOption`, `ChoiceListOptions`, `ChoiceListHandle`, `ListRowOptions`, `ListRowAction`, `ListGroupOptions`, `ComposerOptions`, `ComposerHandle`, `KeyValueRow`, `MenuItemSpec`, `ActionId`, `SubpageLink`, `ConfirmOptions`, `PromptOptions`, `ChooseOptions`, `FormOptions`.

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

The parts that draw into the page (button, segmented, table, the states, badge, dot, status text, count badge, chip, the form controls, tabs, toolbar, callout, card, check list, choice list, list row and group, composer, key-value list, action, the settings parts) take the element to draw into as their first argument and append to it. Modals take `app` first, `ui.menu` takes an event or point, and `ui.notice` takes only its text.

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
  columns: [{ key: 'name', title: 'Name', cell: (p) => p.name }],
  rows: plugins, empty: 'No plugins installed.',
  actions: (p, cell) => ui.action(cell, 'configure', { onClick: () => open(p) }),
});
```

A column's `cell` returns the text, or returns nothing and fills the `td` itself. Pass `groups` (`{ title, rows }`) instead of `rows` for grouped tables, and `onRowClick` to make rows clickable. `setRows` / `setGroups` on the handle redraw it. `empty` is shown when there are no rows.

### ui.emptyState, ui.loadingState, ui.errorState

```ts
ui.emptyState(el, 'Nothing here yet.');
ui.loadingState(el);                       // "Loading…"
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

Tones: `default`, `accent`, `danger`, `success`, `warning`. `pulse` makes a dot blink slowly (not when the system asks for reduced motion); keep it for something waiting on the user.

### ui.countBadge

```ts
const unread = ui.countBadge(tabHeader, 3, { label: 'unread' }); // read as "3 unread"
unread.set(0);  // hidden at 0
unread.set(12); // "9+": above `max` (default 9) it shows max and a plus
```

It is a `role="status"` live region: screen readers hear the exact count with the label ("12 unread"), not "9+".

`pulse: true` blinks it like a pulsing dot.

### ui.chip

```ts
ui.chip(el, 'project');
ui.chip(el, 'draft', { tone: 'accent', title: 'Status', onRemove: () => removeTag('draft') });
```

A tag-like label. With `onRemove` it has an × button; a click removes the chip from the page and then calls `onRemove`.

### ui.field and the input parts

`ui.field` draws a label, a slot for one control (`control`), an optional hint and an error line. An input part drawn into `control` is named by the label and described by the hint, so it needs no `label` of its own.

```ts
const name = ui.field(el, { label: 'Name', hint: 'Shown in the sidebar.' });
ui.textInput(name.control, { value: note.name, onInput: (v) => name.setError(v.trim() ? null : 'Enter a name.') });

const kind = ui.field(el, { label: 'Kind', inline: true });              // label and control on one row
const pick = ui.dropdown(kind.control, { options: [{ value: 'local', text: 'Local' }, { value: 'synced', text: 'Synced' }], value: 'local', onChange: setKind });

const sync = ui.toggle(el, { value: true, label: 'Sync this vault', onChange: setSync });
ui.textInput(el, { secret: true, label: 'API key', onEnter: save });  // a password input
ui.slider(el, { min: 10, max: 30, value: 16, label: 'Font size', onChange: setSize });
ui.searchInput(el, { placeholder: 'Filter plugins', onSearch: (q) => filter(q) });
```

| Part | Returns | Notes |
| --- | --- | --- |
| `field(parent, { label, hint?, inline? })` | `{ el, control, setError(msg \| null) }` | `setError` shows the message and marks the control invalid; `null` clears it. |
| `textInput(parent, { value?, placeholder?, secret?, type?, label?, onInput?, onEnter? })` | the `<input>` | `type` is `text` (default) or `number`; `secret` hides the text. |
| `toggle(parent, { value, label, disabled?, onChange? })` | `{ el, setValue, setDisabled }` | Obsidian's switch (`checkbox-container`) with its label; Space and Enter flip it. `setValue` does not call `onChange`. |
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

A banner or an inline message. Tones: `info` (default), `accent`, `warning`, `danger`, `success`. `text` is a string or a `DocumentFragment`. `action` takes `ui.button`'s options and draws a button after the text. `live: true` has screen readers read the text when it changes; use it for an error or status line that updates. The handle has `setText`, `setTone`, `hide` and `show`. It is also Obsidian's `callout`, so a theme's callout colours apply.

### ui.card

```ts
const c = ui.card(el, { title: 'Claude Code', icon: 'terminal' });
ui.statusText(c.body, 'Signed in', 'success');
c.setTone('warning');
```

A bordered block with a head (icon and title; hidden when there is neither) and a `body` you draw into. Add actions or a status to `head`. Tones: `default`, `accent`, `warning`, `muted` (a finished or inactive item). `compact` has less padding.

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

`choiceList` is a list of option rows to pick from inline: one (`onChange` gets the value) or, with `multi: true`, any number (`onChange` gets the values in option order). A row can have a `detail`, `icon`, `tag` and `key`; the arrow keys move between rows, Enter or Space picks, and an option's `key` picks it while the list has focus. `ui.choose` draws its rows with it. The handle has `setValue`, which does not call `onChange`.

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
ui.emptyState(paneEl, 'No open chats.', { variant: 'pane' });
```

Rows for a sidebar pane list. A row has a title and optionally an `icon`, a status `dot`, a `tag`, faint `meta` text and icon `actions` (shown on hover, focus, or when the row is `active`). With `onClick` the row can be focused and Enter runs it. `menu` is built fresh on each right-click and opens like `ui.menu`. `obsidianClass: 'tree-item'` also gives the row Obsidian's file-tree classes (`tree-item-self nav-file-title`), so a theme's file-tree look applies; `'nav-file-title'` gives only the `nav-file-*` ones. `listRow` returns the row.

`listGroup` is a collapsible group: a header with a chevron, the title and an optional `count`, and a `body` to put the rows in. Clicking the header (or Enter) toggles it and calls `onToggle` with the new state. Use `emptyState` with `variant: 'pane'` when a pane has no rows.

### ui.composer

```ts
const box = ui.composer(el, {
  placeholder: 'Ask anything', hint: 'Enter sends, Shift+Enter starts a new line.',
  onSubmit: async (text) => { await send(text); },
});
box.focus();
```

A text box with a send button. `submitOn: 'enter'` (default) sends on Enter; `'mod-enter'` sends on Cmd/Ctrl+Enter and leaves Enter for new lines. Blank text is not sent. When `onSubmit` returns a promise, the composer is busy until it settles. The box is cleared once `onSubmit` returns or its promise resolves; when it throws or rejects, the text stays. Other options: `rows` (3), `submitLabel` ("Send"), `submitIcon` (an icon button instead of a text one). The handle has `input`, `setBusy`, `focus` and `clear`.

### ui.keyValue

```ts
ui.keyValue(el, [
  { key: 'Name', value: 'Letterboxd' },
  { key: 'Connect to', value: hosts, isNew: (h) => !before.includes(h) },
  { key: 'Secrets', value: [], empty: 'None' },
]);
```

A definition list. A value is text, a list of strings (drawn as a list; `isNew` marks items with a "new" badge), or a node drawn as given. An empty string or list shows `empty` ("None" by default).

### ui.confirm, ui.prompt, ui.choose, ui.form

Each takes the app first and returns a promise. A cancel (Cancel button, Escape, click on the backdrop) resolves to `false` for `confirm` and `null` for the others.

```ts
const ok = await ui.confirm(app, { title: 'Discard changes', message: 'Discard the changes to this note?', action: 'Discard', danger: true });
const name = await ui.prompt(app, { title: 'Rename note', label: 'Name', value: note.name, action: 'Rename', validate: (v) => (v.trim() ? null : 'Enter a name.') });
const pick = await ui.choose(app, { title: 'Pick a template', options: [{ value: 'blank', text: 'Blank', detail: 'An empty note' }] });
const v = await ui.form(app, { title: 'Add a vault', action: 'Add vault', fields: [{ id: 'path', kind: 'text', label: 'Path' }, { id: 'sync', kind: 'checkbox', label: 'Sync it' }] });
```

Form fields (`Field`) are `text` (with `placeholder`, `secret`), `checkbox` (with an optional `detail` line), `select`, `choice` (one of a list of rows) and `multi` (a check list: any number of `options`, each with an optional `detail` and `disabled`). The form resolves to an object keyed by field `id` (`FieldValues`): strings, booleans, and a string array for a `multi` field.

### ui.menu, ui.moreButton

```ts
ui.menu([{ title: 'Rename', icon: 'pencil', onClick: rename }, 'separator', { title: 'Delete', icon: 'trash-2', danger: true, onClick: del }], event);
ui.moreButton(el, () => [{ title: 'Rename', onClick: rename }]);  // "..." icon button; the list is built each time it opens
```

`ui.menu` opens at a mouse event or an `{ x, y }` point.

### ui.notice

```ts
ui.notice('Imported 12 notes', { kind: 'success' });  // kind: info (default), success, error; timeoutMs optional
```

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

`delete` needs `app` and `subject`, and always confirms with a danger modal ("Delete X? This cannot be undone."). Only your `onClick` runs on a yes.

### ui.settings

```ts
const rows = ui.settings.section(containerEl, 'Items');          // heading + container; put rows in the container
ui.settings.row(rows).setName('Name').addText((t) => t.setValue(v));  // Obsidian's Setting
ui.settings.summaryRow(rows, { name: 'Sync', desc: 'On', onClick: openSync, chevron: true });
ui.settings.subpageRow(app, rows, { name: 'Items', desc: '3 items', title: 'Items', render: (page) => fill(page) });
ui.settings.scopeBar(containerEl, { editingDefaults: false, onChange: (d) => setScope(d) });
```

`subpageRow` opens a drill-in page with a Back button and fills it with `render` each time it opens. `openSubpage(app, title, render)` does the same without a row. `scopeBar` is the "Editing: Home / Vault Defaults" switch for a setting that has both layers.

## Vault apps

Vault apps (the sandboxed micro-apps that live in the vault) get the same parts from the package `@helenite/ui-kit`, not from `helenite`:

```ts
import { button, segmented, table, emptyState, badge, statusDot, field, textInput, toggle, dropdown, tabs, callout, card, listRow, cardGrid, picker, setBridge, confirm, prompt, choose, form, menu, notice } from '@helenite/ui-kit';
```

The parts that draw into the page (button, segmented, table, the states, badge, statusDot, statusText, countBadge, chip, field and the input parts, tabs, toolbar, callout, card, checkList, choiceList, listRow, listGroup, composer, keyValue) are the same functions as in `helenite`: they take the element and the same options as above, and work directly inside the app's frame. Every app frame loads the design-system stylesheet, which carries the button variants (primary, danger, icon) itself, so the parts look the same as in plugins without any CSS from the app. It also carries a copy of Obsidian's switch and input looks for the form controls, since a frame has no Obsidian stylesheet (the frame's base stylesheet styles `select`, so a dropdown keeps a plain select look there). Importing `@helenite/ui-kit` installs an icon renderer that draws the standard action icons, `more-horizontal`, `chevron-right` and a few more (`check`, `plus`, `search`, `chevron-down`) as inline SVG; any other icon name is only set as `data-icon` on the icon element, so pass `setIconRenderer` your own renderer if you need more. ui-kit's own parts (cardGrid, posterRow, picker and calendarStrip) also need `@helenite/ui-kit/ui-kit.css` in the app's `view.css`.

An app that inherits the theme (the default) gets the host's resolved theme variables on its frame's `body`, so they match the host exactly, and the theme's and snippets' CSS restyle the parts (see [STYLING.md](./STYLING.md)). The frame's page background always stays transparent, whatever a theme or snippet paints on `html` or `body`; to paint a background, style an element inside the app.

Overlays take the same options as the plugin versions, minus `app`, and are drawn by the host through the capability bridge. Connect the bridge first, with the `api` your app's default export receives. Without it, every overlay and `notice` throws:

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

Differences from the plugin versions: `prompt` has no `validate`, because a callback cannot cross the bridge. `choose` shows a list with a "Select" action. `menu` takes a point inside the frame. A `listRow`'s `menu` opens through the bridge as well, so it needs `setBridge` too.

**Host support is not complete yet.** `notice` works in an app today once `setBridge(api)` has been called, but the frame's `api.ui.notice` drops its options, so `kind` and `timeoutMs` are not honoured yet. `confirm`, `prompt`, `choose`, `form` and `menu` need the host to render app modals and menus, and that renderer is not built yet, so they do not open in an app today. Their signatures are fixed, so code written against them will start working when the host support lands.

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
| Tell the user something happened | `ui.notice`, not a modal |

Prefer a standard action (`ui.action`) to a hand-made button whenever one of the nine fits.

## Copy rules

- A modal's title is a verb phrase: "Rename note", "Add a vault", "Discard changes". Not "Confirm" or "Are you sure?".
- The action button repeats the verb: Rename, Add vault, Discard. Never "OK".
- Escape and a click on the backdrop mean cancel.
- Deleting always asks first, and the modal says it cannot be undone.
- Use sentence case. Name the thing ("Delete Notes", not "Delete").
