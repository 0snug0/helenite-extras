# @helenite/ui-kit

Plain-DOM components for sandboxed Helenite apps, built on `@helenite/ui`. No framework, no `innerHTML`, no network or storage; styled only by theme variables.

The frame loads `design-system.css` (buttons, tables, badges, states) and then the app's `view.css`, which imports `src/ui-kit.css` for the parts below.

```js
import { setBridge, table, button, emptyState, cardGrid, posterRow, picker, tabs, confirm, choose, menu, notice } from "@helenite/ui-kit";
setBridge(api);                          // the app's capability api: modals/menus/notices are drawn by the HOST
const yes = await confirm({ title: "Remove?", message: "This cannot be undone.", action: "Remove", danger: true });
```

## Re-exported from `@helenite/ui`

`button`, `segmented`, `table`, `emptyState`, `errorState`, `loadingState`, `badge`, `statusDot`, `setIconRenderer`, `renderIcon`, and the `Field` type. They are the same functions, with the same `(parent, options)` signatures as in the `helenite` module.

A frame has no Obsidian `setIcon`, so importing the kit installs `kitIconRenderer`: the icons in `KIT_ICONS` (the standard action icons, `more-horizontal`, `chevron-right`, `chevron-down`, `check`, `plus`, `search`) are drawn as inline SVG; other names only get `data-icon`. Call `setIconRenderer` to replace it.

## Overlays

Same options objects as the `helenite` module's overlays, without the `app` argument. Each one sends a declarative spec to the host: a Cancel action first, then your `action` label as the primary (or `danger`) action. Nothing reads "OK".

| Call | Resolves with |
| --- | --- |
| `confirm({ title, message, action, danger?, cancel? })` | `boolean` |
| `prompt({ title, label?, value?, placeholder?, action })` | `string \| null` |
| `choose({ title, options: [{ value, text, detail?, disabled? }] })` | the chosen `value` or `null` |
| `form({ title, fields, action, danger? })` | `Record<string, string \| boolean> \| null` |
| `menu(items, { x, y })` | nothing; runs the chosen item's `onClick` |
| `notice(text, { kind?, timeoutMs? })` | nothing |

`prompt` has no `validate`: the host draws the dialog, so a callback cannot cross the bridge. Check the value after it resolves.

## Kit parts

`cardGrid`, `posterRow`, `picker`, `tabs`, `calendarStrip`, `textInput`, `searchInput`, `select`, `checkbox`, `field`, `toolbar`. Classes are `hel-*`. Each returns `{ el, ...handle }`, or an element for controls.

Secrets and links also go through the host: `promptSecret(name)` and `openUrl(url)`. See `src/bridge.ts` for the specs the host implements.
