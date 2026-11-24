# {{name}}

A Helenite vault app, made by create-helenite. Its view draws a card with a table and a button, saves each click in the app's store, and shows a notice.

The full guide is `docs/dev/vault-apps.md` in the helenite-extras repository.

## Files

| File | What it is |
| --- | --- |
| `app.md` | The manifest (frontmatter) and the app's own docs (body). `theme: inherit` loads the user's theme in the frame. |
| `view.js` | The view: `export default async function mount(root, api)`, returning a cleanup function. |
| `view.css` | The view's own CSS (empty: the parts it uses are styled already). |
| `ui-kit.js` | `@helenite/ui-kit`, bundled. Do not edit it. |

There is no build step: Helenite loads `view.js` as an ES module.

## Install it

Copy this folder into a vault's `Apps` folder, for example `<vault>/Apps/{{name}}/`. Helenite watches `Apps/` and picks it up (the command "Apps: Rescan apps" does it by hand). Open it with "Apps: Open app…", or embed it in a note:

````md
```helenite-app {{id}}
```
````

The first time it opens, and whenever the permissions in `app.md` change, Helenite asks the user to approve them. This app declares no network, vault, secret or connector access; its own store (`api.store`) needs no declaration.

Edit `view.js` and save: Helenite reloads the app's open views.

## What works in a frame today

- The parts that draw into the page (`button`, `table`, `card`, `field`, `toggle`, `tabs`, `callout` and the rest) work fully.
- `notice` works once `setBridge(api)` has run, but the host drops its options for now, so `kind` and `timeoutMs` are ignored.
- `confirm`, `prompt`, `choose`, `form` and `menu` need the host to draw app modals and menus, which is not built yet. They do not open in an app today. Their signatures are final, so code written against them will start working when that lands.

To update `ui-kit.js`, scaffold a new app with create-helenite and copy its `ui-kit.js` over this one.
