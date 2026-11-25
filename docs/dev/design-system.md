# The design system

Helenite's UI is built from a set of parts: buttons, tables, form controls, modals, settings rows and so on. Plugins get them from the `helenite` module, vault apps from `@helenite/ui-kit`. Use them instead of your own markup: they look right in every theme, carry Obsidian's own classes so theme styles still apply, and handle focus, keyboard and screen readers.

```ts
import { ui } from 'helenite';

ui.button(el, { text: 'Save', variant: 'primary', onClick: save });
```

Every part is `name(parent, options)` and returns a handle (modals take `app` first and return a promise). The full reference, with every option and handle method, is [docs/design-system/README.md](../design-system/README.md). Every class and `--hel-*` variable is in [STYLING.md](../design-system/STYLING.md).

## See them live

Open Settings, **Design system** in Home. It draws every part, live in the current theme, next to the code that drew it. It is the quickest way to pick a part, and to check a theme ([themes.md](./themes.md)).

## Which part for what

| You want to | Use |
| --- | --- |
| A button | `ui.button`; for a common job (back, close, reset, configure, delete, remove, add, open...) `ui.action`, which fixes the icon, label and look |
| One choice from a few | `ui.segmented` (or `ui.tabs` when each choice shows its own panel) |
| One choice from many | `ui.dropdown`; rows with details, picked inline: `ui.choiceList` |
| Several on/off choices | `ui.checkList` |
| A labelled input | `ui.field` with `ui.textInput`, `ui.toggle`, `ui.dropdown` or `ui.slider` in its `control` |
| A list of records | `ui.table`, with `ui.action` buttons in its `actions` column |
| Rows in a sidebar pane | `ui.listRow` in a `ui.listGroup`, with `ui.paneHeader` above |
| Nothing to show, loading, failed | `ui.emptyState`, `ui.loadingState`, `ui.errorState` |
| A status | `ui.badge`, `ui.statusDot`, `ui.statusText`, `ui.countBadge` |
| How full something is (context, a quota), on one line | `ui.meter` |
| A banner or inline message | `ui.callout` |
| A boxed group | `ui.card` (`ui.settings.card` on a settings page) |
| Ask yes or no | `ui.confirm` (`danger: true` when it destroys something) |
| Ask for one line of text | `ui.prompt` |
| Pick one of several named options | `ui.choose` |
| Collect several values | `ui.form` |
| Your own modal content | `ui.dialog` |
| Tell the user something happened | `ui.notice`, not a modal |
| A context menu | `ui.menu`, `ui.moreButton`, `ui.menuButton` |
| A settings page | `ui.settings.section`, `summaryRow`, `subpageRow`, `card`, `vaultScope`, `scopeBar` |

## Copy

- A modal's title is a verb phrase ("Rename note", "Add a vault"), and its action button repeats the verb ("Rename", "Add vault"). Never "OK".
- Escape and a click on the backdrop cancel.
- Deleting always asks first and says it cannot be undone; `ui.action(el, 'delete', { app, subject, onClick })` does that for you.
- Sentence case, and name the thing ("Delete Notes", not "Delete").

## In vault apps

`@helenite/ui-kit` re-exports the parts that draw into the page with the same signatures, and adds overlays (`confirm`, `prompt`, `choose`, `form`, `menu`, `notice`) drawn by the host through the app's `api`. Not all of those work yet; see [vault-apps.md](./vault-apps.md#the-ui-kit).
