---
name: helenite-notes
description: Session notes, helenite-ask widgets and frontmatter conventions in Helenite. Use when updating the session note, asking the user something, or reading what the user answered.
---

# Session notes in Helenite

Every Helenite session has a note `Chats/YYYY-MM-DD Session <id>.md`. Frontmatter: `helenite: session`, `session_id`, `profile`, `transcript_path`, `status` (idle, busy or waiting). Helenite owns the file: **never edit it with Write/Edit/Bash**; those are denied.

Sections: Goal, Decisions, Plan (checkboxes), Open questions, Changes, Notes.

- Read it: `mcp__helenite__summary_read` (optionally `section`).
- Update it: `mcp__helenite__summary_update_section` with `section`, `text`, `mode` (`replace` or `append`). Keep Goal to one or two sentences, Decisions to a bullet each, Plan as `- [ ]` / `- [x]` items. Changes is appended automatically on every edit you make.
- Ask the user with `mcp__helenite__ask` (or `mcp__helenite__wizard` for several fields); `AskUserQuestion` is fine for a quick choice with no context. Each question is a file `Chats/<uuid>/<uuid>-N.md` (frontmatter `helenite: ask`) that opens as its own tab, and you receive the answer as the tool result. The session note gets a collapsible summary callout per question: `[!question]-` pending, `[!success]-` answered, `[!failure]-` dismissed. Never ask in prose.
- The user may also edit the note's prose. Helenite sends you the diff as a `<note_edit>` message when you are idle; treat it as an instruction.
- Question files and their callouts stay as a record. You may read them, but never write, rewrite or delete question files or the chat note directly.
