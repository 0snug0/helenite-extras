# Local model for quick decisions

`@helenite/local-llm` lets Helenite hand a small either-or question to a cheap model running on this computer, so
it doesn't cost agent tokens. Every question names a rule-based `fallback`, which answers whenever the model is
off, missing, slow, unsure, or not allowed to run by the power rule. Nothing may depend on the model being there.

## Asking

From a plugin (any vault):

```ts
const d = await window.helenite.localLlm.decide({
  question: 'What kind of Obsidian plugin is "Style Settings"?',
  options: [
    { id: 'needs-port', description: 'Adds a feature of its own, or works on notes or data' },
    { id: 'cosmetic', description: 'Changes nothing but appearance' },
  ],
  context: 'Description: Adjust theme CSS variables.',
  fallback: 'needs-port',
});
// d.choice, d.source ('model' | 'fallback'), d.why, d.confidence?, d.ms
```

2 to 12 options; context is capped at 6000 characters. Treat a `model` answer as a guess: show it as a hint, or
use it to pick between things that are all safe. `localLlm.status()` says what would answer and why not.

## Backends

Looked for in this order; the first with a usable model wins.

| Runtime | Kind | Endpoint |
| --- | --- | --- |
| Ollaya (Jev-style decision models) | `decision`: `POST /v1/systemone`, returns a choice with a confidence | `127.0.0.1:11435` |
| Ollama | `chat`: OpenAI-compatible, held to the option ids by a JSON schema | `127.0.0.1:11434` |
| LM Studio | `chat` | `127.0.0.1:1234` |

The smallest suitable model is used unless `model` is set. Embedding and fill-in models are skipped. A decision
model's answer below `minConfidence` (0.6) goes to the fallback. The Ollaya request shape follows its published
TypeSafe-compatible format and has unit tests, but has not been run against a live Ollaya.

## Settings

Home stores them in `local-llm.json` (Settings → Setup, and the last step of the setup wizard):

- `enabled`: off until the user turns it on. The wizard offers it switched on when a model is found.
- `power` / `minBattery`: `always`, `plugged-in`, or `plugged-in-or-battery` (default, 50%). On battery with an
  unreadable charge counts as not allowed.
- `baseURL` / `kind` / `model` / `timeoutMs` / `minConfidence`: file-only for now.

## First use

The New vault wizard's Obsidian scan asks about each plugin that needs a Helenite version and marks the ones the
model reads as "likely looks only" or "likely built in" (`apps/desktop/src/main/home/obsidian-hints.ts`). The scan
shows at once; the hints fill in when they arrive.

## Design reviews

A design-review card (`ask` with `review`) asks about each section: does it need the reader's eye, or is it safe to
leave on the agent's pick? Sections get a "Worth a look" or "Likely fine" chip, the first one worth a look opens,
and a button folds the likely-fine ones away (`plugins/core-ask-widgets/src/review-hints.ts`). The card shows at
once and the hints fill in; they never change an answer, and with no model the card is the plain one.
