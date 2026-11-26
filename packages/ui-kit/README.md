# @helenite/ui-kit

Plain-DOM components for sandboxed Helenite apps, built on `@helenite/ui`. No framework, no `innerHTML`, no network or storage; styled only by theme variables.

The frame loads `design-system.css` (every `@helenite/ui` part: buttons, tables, states, badges, form controls, tabs, toolbar, callout, card, disclosure, check and choice lists, list rows, composer, key-value list, code block, thread) and then the app's `view.css`, which imports `src/ui-kit.css` for the parts below.

```js
import { setBridge, table, button, emptyState, cardGrid, posterRow, picker, tabs, confirm, choose, menu, notice } from "@helenite/ui-kit";
setBridge(api);                          // the app's capability api: modals/menus/notices are drawn by the HOST
const yes = await confirm({ title: "Remove?", message: "This cannot be undone.", action: "Remove", danger: true });
```

## Re-exported from `@helenite/ui`

`button`, `segmented`, `table`, `emptyState`, `errorState`, `loadingState`, `badge`, `statusDot`, `statusText`, `countBadge`, `chip`, `avatar`, `swatch`, `pickerGrid`, `field`, `textInput`, `searchInput`, `slider`, `toggle`, `dropdown`, `tabs`, `toolbar`, `callout`, `card`, `disclosure`, `checkList`, `choiceList`, `listRow`, `listGroup`, `composer`, `artwork`, `mediaGrid`, `mediaCard`, `figures`, `rating`, `statTiles`, `sectionHeading`, `monthGrid`, `keyValue`, `codeBlock`, `meter`, `barChart`, `thread`, `threadText`, `board`, `setIconRenderer`, `renderIcon`, `setMenuRenderer`, `openMenu`, `drawFields` (draws `Field`s as a form's rows and reads their values), and their option and handle types (with `Field`, `FieldValues` and `MenuItemSpec`). They are the same functions, with the same `(parent, options)` signatures as in the `helenite` module. The form controls, `tabs` and `toolbar` used to live here with options-only signatures (`textInput(o)`, `select(o)`, `checkbox(o)`, `field(label, control)`, `toolbar(...kids)`); `select` is now `dropdown` and `checkbox` is now `toggle`.

A frame has no Obsidian `setIcon`, so importing the kit installs `kitIconRenderer`: any [Lucide](https://lucide.dev/icons) name works (`terminal`, `file-text`, with or without `lucide-`). The icons in `KIT_ICONS` (the standard action icons, `more-horizontal`, `chevron-right`, `chevron-down`, `check`, `plus`, `search`, and `densityAction`'s `align-justify` and `rows-2`) are inside the kit and draw at once; every other name is asked of the host (`api.ui.icons`, so call `setBridge`; names drawn together go in one call) and draws when it answers, so your bundle does not carry the icon set. A name the host does not know, or any other name on a host older than this, only gets `data-icon`. Call `setIconRenderer` to replace the renderer. It also installs a menu renderer, so a `listRow`'s `menu` opens as a host menu through the bridge (call `setBridge` first).

## Overlays

Same options objects as the `helenite` module's overlays, without the `app` argument. Each one sends a declarative spec to the host: a Cancel action first, then your `action` label as the primary (or `danger`) action. Nothing reads "OK".

| Call | Resolves with |
| --- | --- |
| `confirm({ title, message, action, danger?, cancel? })` | `boolean` |
| `prompt({ title, label?, value?, placeholder?, action })` | `string \| null` |
| `choose({ title, options: [{ value, text, detail?, disabled? }] })` | the chosen `value` or `null` |
| `form({ title, fields, action, danger? })` | `FieldValues \| null`: strings, booleans, and a string array for a `multi` field |
| `menu(items, { x, y })` | nothing; runs the chosen item's `onClick` |
| `notice(text, { kind?, timeoutMs? })` | nothing |

`prompt` has no `validate`: the host draws the dialog, so a callback cannot cross the bridge. Check the value after it resolves.

The host draws each one over the whole window with its own dialog and menu, labelled with your app's icon, name and id; your app cannot style or place it (`choose` is wide; nothing else changes the size). The host checks the spec (a title up to 120 characters, up to 20 body blocks, 20 fields and 3 actions besides Cancel, and up to 50 menu items): a bad one rejects with an error whose `code` is `invalid-spec`. A `form` field with `secret: true` rejects with `secret-field`; use `promptSecret(name)` for secrets. One modal at a time: a second one while the first is open rejects with `modal-open`, and more than 5 in 10 seconds with `modal-rate`. A menu opens over your frame: `{ x, y }` is kept inside it. When the view closes, an open modal or menu closes and resolves as a cancel.

An app can still draw its own modal by lifting its frame over the whole window with `api.ui.overlay(true)` (and `false` to put it back). The host then draws a "From <app> · <id>" strip across the top of the window, above the frame, which the app cannot cover or restyle. Prefer the overlays above.

## Actions, menu buttons and the pane header

The `helenite` module's standard-action parts, for frames:

| Call | Draws |
| --- | --- |
| `action(parent, id, { onClick, label?, variant?, subject?, title?, message?, confirmText? })` | A standard action from `STANDARD_ACTIONS` (`back`, `close`, `reset`, `useDefault`, `editInHome`, `configure`, `turnOff`, `delete`, `open`, `remove`, `add`, `moveUp`, `moveDown`, `reconnect`) with its icon, label and variant. `delete` and `remove` need a `subject` and ask in a host `confirm` first ("Delete <subject>? This cannot be undone.") |
| `moreButton(parent, items, label?)` | An icon button (`more-horizontal`) that opens `items()` as a host menu under it |
| `menuButton(parent, { text, items, variant? })` | A text button with a chevron (`is-menu`, `aria-haspopup="menu"`) that opens `items()` under it |
| `paneHeader(contentEl, actions)`, `densityAction(density, onChange)` | The icon-button row at the top of a pane, and its one line / two lines toggle. Same functions as `ui.paneHeader` and `ui.densityAction` |

They take the `helenite` module's options without `app`. Menu items' `checked` and `tooltip` are not drawn by the host menu.

Not in the kit: `ui.dialog` (a plugin modal the plugin draws into; a frame can only send the host a modal spec, which `confirm`, `prompt`, `choose` and `form` cover) and `ui.settings.*` (rows built on Obsidian's `Setting` inside the Settings window and its sub-pages, which a frame does not have).

## Kit parts

`frameDialog({ label, onClose })` draws a large dialog in the frame for content a host modal cannot show (a table with its own buttons) and returns `{ el, modal, body, destroy }`; lift the frame with `api.ui.overlay(true)` while it is open.

`cardGrid` (its cards are `ui.card`'s `hel-card`, styled by design-system.css), `posterRow`, `picker`, `calendarStrip`. Classes are `hel-*`. Each takes an options object and returns `{ el, ...handle }`; append `el` yourself.

Secrets and links also go through the host: `promptSecret(name)` and `openUrl(url)`. See `src/bridge.ts` for the specs the host implements.
