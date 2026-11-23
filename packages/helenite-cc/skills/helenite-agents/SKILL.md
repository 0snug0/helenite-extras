---
name: helenite-agents
description: Use when the user wants help designing an agent, or asks to make, change or review a Helenite agent (what it runs on, what starts it, what it may do). Interviews the user, designs from agents_capabilities and proposes the agent with agents_propose for the user to approve in the Agent manager.
---

# Designing a Helenite agent

An agent is a markdown note in Home's `Agents/` folder: what it runs on, what it is told, what it may do, what starts it and what it is held to. You never write that folder. You propose a draft; the user reviews it in the Agents list and saves it there. Until they do, the agent does not exist: never say it was created, and never tell the user it will run.

## 1. Read what is there: `agents_capabilities`

Call `mcp__helenite__agents_capabilities` first, every time, and design only from its answer. Nothing below replaces it.

- `harnesses`: each installed or known CLI, whether this vault may launch it, its capability flags, `usableForAgents` and `why`. Today only Claude Code has `usableForAgents: true`. Other harnesses (Codex, Gemini CLI, OpenCode) are listed but cannot run an agent yet; `why` says what is missing (no hooks, so tool rules would be advice only; no session ids, so Helenite cannot track its sessions). Tell the user that if they ask for one, and offer Claude Code instead.
- `claude`: the models, efforts and permission modes an agent may use.
- `localModel`: whether the local model is available. A local-model agent only chooses between options a feature gives it; it cannot write or run anything.
- `roles`: what features offer, each with its `actions` (ids like `queue.get`). An agent may do only the actions listed in its `may`.
- `events`, `schedules`: what can start an agent.
- `agents`: the agents that exist (check names and ids for clashes).
- `limits`: the shortest cooldown, the default and largest hourly cap.

## 2. Interview

Ask with `mcp__helenite__ask` (or `mcp__helenite__wizard` for several fields), never in prose. Cover, in order:

1. **The job.** What it does, for which feature or folder, and what done looks like. This becomes `purpose` (one line) and the instructions.
2. **What starts it.** Only by hand (the Run button, or another agent), an event, or a schedule.
3. **What it may do.** Which actions from `roles` it needs; which tools it always may use.
4. **What to forbid.** Tools or commands it must never use (for example `Bash(git push:*)`).
5. **Autonomy.** Whether a triggered run waits for the user to click Run (`ask`) or starts on its own (`auto`). Recommend `ask`. Proposals are always stored as `ask`; only the user can switch it to `auto` in the Agent manager.

## 3. Put each rule where it is enforced

Instructions are advice: the model usually follows them but nothing holds it to them. Anything that must hold goes in a field that is enforced:

- **Helenite enforces** `may` (actions), `triggers`, `limits` (`atOnce`, `hours`, `perHour`), `autonomy` and `canCall`.
- **Claude Code enforces** `permissionMode` and `tools.allow` / `tools.deny` (tool rules such as `WebFetch` or `Bash(rm:*)`).
- **Advice only**: the instructions under the frontmatter.

So "never push" is a `tools.deny` rule, not a sentence in the instructions. Say which is which when you summarise the design.

Other rules:

- `runsOn` is `claude` or `local-model`. **A local-model agent cannot have triggers**, tool rules or a permission mode.
- `autonomy: auto` cannot be combined with `permissionMode: bypassPermissions`. Avoid `bypassPermissions` altogether unless the user insists.
- Triggers: `queue.status` (with `to`: backlog, ready, doing, review, done or dropped), `session.end` (with `agent`: the id to watch), `app.start`, `vault.file` (with `glob` and `event`: create, modify, delete or rename), `schedule` (one of `at: "HH:MM"`, `every: "6h"`, `cron: "0 9 * * 1"`). Each may have a `cooldown` of at least 30s (default 5m). An event an agent caused never starts another agent's trigger.
- `canCall` lists agent ids this agent may start with the `agent_run` tool. Leave it empty unless the job needs a hand-off; each id must be an existing agent.
- Agents that can design agents: only give `agents.read` / `agents.propose` in `may` when the user asks for exactly that.

## 4. Propose: `agents_propose`

Call `mcp__helenite__agents_propose` with `name` (shown to the user, and the note's file name) and `draft`, the full note text:

```markdown
---
id: docs-helper
purpose: Answers questions about the docs folder and fixes broken links
runsOn: claude
model: sonnet
effort: medium
permissionMode: manual
may: [queue.get, queue.close]
tools:
  allow: [Read, Grep]
  deny: ["Bash(git push:*)"]
limits:
  atOnce: 1
  hours: ""
  perHour: 5
triggers:
  - on: vault.file
    glob: "Docs/**/*.md"
    event: modify
    cooldown: 10m
autonomy: ask
---
Read the changed note and the notes it links to. Fix broken links only; ask before rewriting prose.
```

The draft is checked like a saved note. If the tool returns a problem, fix that field and propose again. On success, tell the user: the agent is waiting under **Proposals** in the Agent manager; they open it in the creator wizard (it opens at Review, every step filled in), can change anything, and it becomes an agent when they press Save (or they dismiss it). If the tool says autonomy was stored as `ask`, say so.

## Starting another agent: `agent_run`

A session started from an agent whose `canCall` is not empty has `mcp__helenite__agent_run` (`id`, optional `prompt`). It starts only the agents in that list; anything else is refused.
