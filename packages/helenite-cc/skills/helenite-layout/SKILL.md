---
name: helenite-layout
description: Helenite workspace and dock layout, per-vault layouts, and the tools to inspect and change them. Use when placing a view, opening a note or app in a dock, or reorganising the layout.
---

# Workspace and layout

Helenite follows the Obsidian workspace model: a centre editor area (tabs and splits), a left sidebar, a right sidebar and a bottom dock (terminals). **Layout is per vault**: a change made in a project vault does not affect the global vault.

Tools (all `mcp__helenite__*`):
- `helenite_context`: the vault, layout tree, enabled plugins and apps (with scopes), and the active view. Call it first when a request depends on the current state.
- `workspace_open`: `{kind: file|view|app, path|viewType|appId, dock?, split?, newTab?}`.
- `workspace_layout`: no arguments returns the layout tree; `patch` changes it.
- `view_screenshot`: look at a leaf or dock to verify the result.

In plugin code use the Obsidian API: `app.workspace.getLeftLeaf(false)`, `getRightLeaf(false)`, `getLeaf(true|'split')`, `leaf.setViewState({type, active:true})`, `workspace.revealLeaf(leaf)`, `workspace.onLayoutReady(cb)`. Views are registered with `this.registerView(type, leaf => new MyView(leaf))`; they must restore from saved layout, so make `onOpen()` idempotent.
