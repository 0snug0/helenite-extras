---
helenite-app: 1
id: {{id}}
name: {{nameYaml}}
version: 0.1.0
description: "A starter multi-page Helenite app: a nav bar and two pages (Home, About) that link to each other."
theme: inherit
views:
  - id: main
    title: {{nameYaml}}
    icon: app-window
    entry: view.js
    style: view.css
    placement: [tab, embed, sidebar]
# Declare every secret and setting any page uses; the broker refuses an undeclared one.
# Never mark a secret `required: true` here: one missing key would block every page. A page shows a setup state instead.
secrets:
  - { name: EXAMPLE_API_KEY, label: Example API key, hosts: ["https://api.example.com"] }
net:
  - https://api.example.com
---
# {{name}}

A multi-page Helenite vault app, made by create-helenite (`--template app-pages`). `view.js` lists the pages, `shell.js` and
`router.js` draw the nav and swap the panes (copied from Helenite's Media app; do not edit them), and each page is a folder
under `pages/` whose `index.js` exports `(el, ctx) => cleanup`.

Link to a page from a note:

```helenite-app {{id}} page=about
```

To add a page: make `pages/<name>/index.js`, then add it to `NAV` and `PAGES` in `view.js`.
