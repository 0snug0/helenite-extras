---
name: helenite-notes
description: Session notes, helenite-ask widgets and frontmatter conventions in Helenite. Use when updating the session note, asking the user something, or reading what the user answered.
---

# Session notes in Helenite

Every Helenite session has a chat note `Chats/<uuid>.md` (stable Helenite uuid). Frontmatter: `helenite: session`, `helenite_session`, `session_id` (the id Claude reports, which changes on /clear), `title`, `profile`, `transcript_path`, `status` (idle, busy or waiting). Older notes named `Chats/YYYY-MM-DD Session <id8>.md` still exist. Helenite owns the file: **never edit it with Write/Edit/Bash**; those are denied.

Sections: Goal, Decisions, Plan (checkboxes), Open questions, Changes, Notes. Open questions holds one summary callout per question, linking to its question file.

- Read it: `mcp__helenite__summary_read` (optionally `section`).
- Update it: `mcp__helenite__summary_update_section` with `section`, `text`, `mode` (`replace` or `append`). Keep Goal to one or two sentences, Decisions to a bullet each, Plan as `- [ ]` / `- [x]` items. Changes is appended automatically on every edit you make.
- Ask the user with `mcp__helenite__ask` (or `mcp__helenite__wizard` for several fields); `AskUserQuestion` is fine for a quick choice with no context. Each question is a file `Chats/<uuid>/<uuid>-N.md` (frontmatter `helenite: ask`) that opens as its own tab, and you receive the answer as the tool result. The session note gets a collapsible summary callout per question: `[!question]-` pending, `[!success]-` answered, `[!failure]-` dismissed. Never ask in prose.
- The user may also edit the note's prose. Helenite sends you the diff as a `<note_edit>` message when you are idle; treat it as an instruction.
- Question files and their callouts stay as a record. You may read them, but never write, rewrite or delete question files or the chat note directly.

## Design review

After writing a design, spec or plan doc, ask for approval with `mcp__helenite__ask` and `review` instead of `questions` (give exactly one). The doc opens beside a section-by-section card.

- `review.doc` (vault path), optional `review.summary`, and `review.sections` (1-12): `heading` (unique), `summary`, optional `concept` (a short explanation of a pattern the user may not know), optional `options` (2-4 of `label`, `description`, `recommended`). Add `options` only for a real alternative, and mark exactly one `recommended`.
- Result: `{ answers: { <heading>: <label | "Looks good" | "Change: <text>" | "Other: <text>"> }, approved }`; `approved` is true when every section is `Looks good` or its recommended option. Or `{ cancelled: true }`.
- After edits, re-ask with only the changed sections.

```
mcp__helenite__ask({ review: { doc: "Docs/design.md", summary: "Storage and naming.", sections: [
  { heading: "Storage", summary: "Use SQLite for the cache.", concept: "WAL mode lets readers run during a write.",
    options: [{ label: "SQLite", recommended: true }, { label: "Postgres", description: "Needs a server" }] },
  { heading: "Naming", summary: "Kebab-case ids." } ] } })
```
