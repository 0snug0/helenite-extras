---
helenite-app: 1
id: {{id}}
name: {{nameYaml}}
version: 0.1.0
description: "A starter app built with Vite: it lists the notes it is allowed to read."
theme: inherit
views:
  - id: main
    title: {{nameYaml}}
    icon: app-window
    entry: view.js
    style: view.css
    placement: [tab, embed, sidebar]
vault: { read: ["**/*.md"], write: [] }
---
# {{name}}

A Helenite vault app made by create-helenite (`--template app-vite`). `view.js` and `view.css` are built from `src/` by Vite (`npm run build`); do not edit them by hand. Narrow `vault.read` above to the folders the app really needs.

```helenite-app {{id}}
```
