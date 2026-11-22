---
name: helenite-docs
description: How to write a document the user will read in Helenite, such as a design spec, design doc, proposal, plan or explainer, including the wireframe and concept blocks that show a screen or an interaction instead of describing it. Use before writing or revising any doc meant for the user to read and approve.
---

# Docs the user reads

The user reads these to decide something. Write so they can decide quickly: say what and why first, show what is easier seen than read, and keep the rest short.

## Shape

1. **Title and one line** saying what this is and what you need from the reader.
2. **Why**: the problem, in the user's words where you have them.
3. **What changes for them**: the behaviour they will see. This is where a visual usually belongs.
4. **Decisions**: one short section each. What you picked, what else was on the table, what it costs. Mark which were the user's and which are your call.
5. **Not doing**, and anything still open.

Keep sections to a few short paragraphs. Put comparisons in a table, not in prose. Leave implementation detail (file lists, function names) to the plan, unless the doc is the plan.

## When to show instead of tell

Add a visual only where seeing it is faster than reading it. At most one per section, and none in a section that is only a decision between words. A doc about a UI change with no wireframe is missing something; a doc about a rename with three diagrams is noise.

| The reader needs to picture | Use |
|---|---|
| A screen, a layout, or a few screens in sequence | `wireframe` |
| A flow, a sequence, states, or how parts connect | Mermaid (see helenite-content) |
| A behaviour you have to try to judge (filtering, drag, a transition, a calculation) | `concept` |
| Options against criteria | a table |
| One thing they must not miss | a callout |

Call `mcp__helenite__vault_capabilities` first. If `wireframe` and `concept` are not listed under `blocks` for `core-docs`, the plugin is off: use Mermaid, tables and prose instead.

## wireframe

A grey-box sketch written as an outline. Indentation nests, the first word is the element, the rest is its text. A line that is not understood is drawn as plain text, so it cannot break.

````
```wireframe
device mobile
screen Inbox
  header Mail | [Compose -> New message]
  tabs
    tab *All
      list
        Alice: Lunch tomorrow? -> New message
        Bob: Q3 report
    tab Unread
      text Nothing new
  note Swipe left archives
screen New message
  header New message | [Cancel -> Inbox]
  input To
  textarea Message
  [*Send -> Inbox]
```
````

- Top: optional `device mobile`, `device tablet` or `device desktop` (default), then `screen <name>` for each screen. With no `screen` line the whole block is one screen.
- Containers: `row` (side by side), `col`, `card <title>`, `sidebar`, `main`, `header`, `footer`, `modal <title>`, `tabs` with `tab <name>` children, `list` (each child line is an item), `table` (each child line is a row, cells split with ` | `, first row is the head).
- Elements: `title`, `text`, `button`, `link`, `input`, `textarea`, `select`, `checkbox`, `radio`, `toggle`, `image`, `avatar`, `badge`, `divider`, `nav A | B | C`, and `note` for a comment to the reader that is not part of the UI.
- `[Label]` is a button inside a plain line, a list item, a table cell, a `title`, a `note`, or a `header`, `footer` or `row` (`Total: $40 [Pay]`). In `header`, `footer` and `row`, ` | ` separates the left and right sides.
- `*` before a label means primary, active or checked: `[*Save]`, `tab *All`, `checkbox *Remember me`, `nav Home | *Mail`.
- `-> Screen name` at the end of a button, link, tab, nav item, list item, element or `card` makes it click through to that screen. Use it to show a flow across two to four screens. A name that matches no screen is listed as a warning under the wireframe.

Sketch structure, not polish: real labels, real example content, no lorem ipsum. Show only the screens the decision is about. Put one sentence under the block saying what to look at.

## concept

A small working demo in HTML, CSS and JS, for behaviour a still picture cannot show. It runs in a locked-down frame.

````
```concept
title: Filter as you type
height: 220
<input id="q" placeholder="Filter…">
<ul id="list"><li>Alpha</li><li>Beta</li><li>Gamma</li></ul>
<script>
  q.oninput = () => {
    for (const li of list.children) li.hidden = !li.textContent.toLowerCase().includes(q.value.toLowerCase());
  };
</script>
```
````

- Optional `title:` and `height:` (pixels, 80 to 1200) lines first, then the markup. Without `height` the box fits its content.
- It must be self-contained. There is no network, so no CDN scripts, web fonts, remote images or `fetch`; inline everything, and use `data:` URLs or inline SVG for images. It cannot read the vault or call Helenite, and it cannot navigate.
- Put all code in `<script>` blocks in the markup. Inline handlers (`onclick="…"`), `eval`, `new Function` and scripts created at run time do not run; wire events with `el.onclick = () => …` or `addEventListener` inside a `<script>`. Building markup with `innerHTML` is fine. At most 30 scripts.
- The theme's CSS variables are available (`--background-primary`, `--background-secondary`, `--background-modifier-border`, `--text-normal`, `--text-muted`, `--interactive-accent`, `--text-on-accent`), and `button`, `input` and body text are already styled. Use them so the demo matches light and dark themes.
- Keep it under about 60 lines and about one idea. Fake the data. It is an illustration, not the feature; say so if it differs from what will be built.
- Use it sparingly. If a `wireframe` with two screens shows the same thing, use the wireframe.

## After writing

Open the doc, run `note_render_check`, and take a `view_screenshot` if it has a wireframe or concept, to confirm they drew. Then ask for approval with `mcp__helenite__ask` and `review` (see helenite-notes), never in prose. A section's `concept` field in a review takes markdown, so a short `wireframe` block works there too.
