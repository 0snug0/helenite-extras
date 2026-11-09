---
name: helenite-notes
description: Session notes, helenite-ask widgets and frontmatter conventions in Helenite. Use when updating the session note, asking the user something, or reading what the user answered.
---

# Session notes in Helenite

Every Helenite session has a note `Chats/YYYY-MM-DD Session <id>.md`. Frontmatter: `helenite: session`, `session_id`, `profile`, `transcript_path`, `status` (idle, busy or waiting). Helenite owns the file: **never edit it with Write/Edit/Bash**; those are denied.

Sections: Goal, Decisions, Plan (checkboxes), Open questions, Changes, Notes.

- Read it: `mcp__helenite__summary_read` (optionally `section`).
- Update it: `mcp__helenite__summary_update_section` with `section`, `text`, `mode` (`replace` or `append`). Keep Goal to one or two sentences, Decisions to a bullet each, Plan as `- [ ]` / `- [x]` items. Changes is appended automatically on every edit you make.
- Ask the user with `AskUserQuestion` (or `mcp__helenite__wizard` for several fields). Each becomes a `helenite-ask` block under Open questions; the user answers in the note, and you receive the answer as the tool result. Never ask in prose.
- The user may also edit the note's prose. Helenite sends you the diff as a `<note_edit>` message when you are idle; treat it as an instruction.
- Answered blocks stay in the note as a record. Do not rewrite or delete them.
