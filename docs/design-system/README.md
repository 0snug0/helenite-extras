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

`version` is the running Helenite version (`0.1.0` today). The public types are exported from the same module, type-only: `ButtonOptions`, `ButtonHandle`, `TableOptions`, `TableColumn`, `TableGroup`, `Field`, `MenuItemSpec`, `ActionId`, `SubpageLink`, `ConfirmOptions`, `PromptOptions`, `ChooseOptions`, `FormOptions`.

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

The parts that draw into the page (button, segmented, table, the states, badge, dot, action, the settings parts) take the element to draw into as their first argument and append to it. Modals take `app` first, `ui.menu` takes an event or point, and `ui.notice` takes only its text.

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
```

### ui.badge, ui.statusDot

```ts
ui.badge(el, 'Beta', 'accent');
ui.statusDot(el, 'success', 'Connected');  // the label is read by screen readers
```

Tones: `default`, `accent`, `danger`, `success`.

### ui.confirm, ui.prompt, ui.choose, ui.form

Each takes the app first and returns a promise. A cancel (Cancel button, Escape, click on the backdrop) resolves to `false` for `confirm` and `null` for the others.

```ts
const ok = await ui.confirm(app, { title: 'Discard changes', message: 'Discard the changes to this note?', action: 'Discard', danger: true });
const name = await ui.prompt(app, { title: 'Rename note', label: 'Name', value: note.name, action: 'Rename', validate: (v) => (v.trim() ? null : 'Enter a name.') });
const pick = await ui.choose(app, { title: 'Pick a template', options: [{ value: 'blank', text: 'Blank', detail: 'An empty note' }] });
const v = await ui.form(app, { title: 'Add a vault', action: 'Add vault', fields: [{ id: 'path', kind: 'text', label: 'Path' }, { id: 'sync', kind: 'checkbox', label: 'Sync it' }] });
```

Form fields (`Field`) are `text` (with `placeholder`, `secret`), `checkbox`, `select` and `choice`. The form resolves to an object keyed by field `id`, with strings and booleans as values.

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
import { button, segmented, table, emptyState, badge, statusDot, cardGrid, picker, setBridge, confirm, prompt, choose, form, menu, notice } from '@helenite/ui-kit';
```

The parts that draw into the page (button, segmented, table, the states, badge, statusDot, cardGrid, picker, and the rest) take the element and the same options as above, and work directly inside the app's frame. Every app frame loads the design-system stylesheet, which carries the button variants (primary, danger, icon) itself, so the parts look the same as in plugins without any CSS from the app. Importing `@helenite/ui-kit` installs an icon renderer that draws the standard action icons, `more-horizontal`, `chevron-right` and a few more (`check`, `plus`, `search`, `chevron-down`) as inline SVG; any other icon name is only set as `data-icon` on the icon element, so pass `setIconRenderer` your own renderer if you need more. ui-kit's own parts (cardGrid, picker, tabs and the rest) also need `@helenite/ui-kit/ui-kit.css` in the app's `view.css`.

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

Differences from the plugin versions: `prompt` has no `validate`, because a callback cannot cross the bridge. `choose` shows a list with a "Select" action. `menu` takes a point inside the frame.

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
| Pick one of several named options | `ui.choose` |
| Collect several values at once | `ui.form` |
| Tell the user something happened | `ui.notice`, not a modal |

Prefer a standard action (`ui.action`) to a hand-made button whenever one of the nine fits.

## Copy rules

- A modal's title is a verb phrase: "Rename note", "Add a vault", "Discard changes". Not "Confirm" or "Are you sure?".
- The action button repeats the verb: Rename, Add vault, Discard. Never "OK".
- Escape and a click on the backdrop mean cancel.
- Deleting always asks first, and the modal says it cannot be undone.
- Use sentence case. Name the thing ("Delete Notes", not "Delete").
