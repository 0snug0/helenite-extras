---
helenite-app: 1
id: {{id}}
name: {{nameYaml}}
version: 0.1.0
description: "A starter Helenite app: a card with a table, a button and a notice."
theme: inherit
views:
  - id: main
    title: {{nameYaml}}
    icon: app-window
    entry: view.js
    style: view.css
    placement: [tab, embed, sidebar]
---
# {{name}}

A Helenite vault app, made by create-helenite. Each click on "Add a click" is saved in the app's store and listed in the table.

Embed it in a note:

```helenite-app {{id}}
```
