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
| Apple Intelligence (the model built into macOS) | `apple`: a bundled helper program asks the Foundation Models framework, held to the option ids by guided generation | none: no server, nothing to install |
| Ollama | `chat`: OpenAI-compatible, held to the option ids by a JSON schema | `127.0.0.1:11434` |
| LM Studio | `chat` | `127.0.0.1:1234` |

The smallest suitable model is used unless `model` is set. Embedding and fill-in models are skipped. A decision
model's answer below `minConfidence` (0.6) goes to the fallback. The Ollaya request shape follows its published
TypeSafe-compatible format and has unit tests, but has not been run against a live Ollaya.

## Apple's on-device model

On a Mac with Apple Intelligence turned on, decisions work with nothing installed. Requirements, from Apple's
Foundation Models documentation: macOS 26 or later, an Apple silicon Mac that supports Apple Intelligence, Apple
Intelligence switched on in System Settings, and the model finished downloading. The model has a 4,096-token
window (instructions, question, options, context and answer together), so a long `context` can fail and go to the
fallback. It reports no confidence, so `minConfidence` does not apply to it, as with chat models.

The pieces:

- `packages/local-llm-apple/`: `helenite-apple-llm`, a single-file Swift command-line program.
  `helenite-apple-llm --check` prints `{"available":true}` or `{"available":false,"reason":"…","detail":"…"}`
  (reasons: `osTooOld`, `deviceNotEligible`, `appleIntelligenceNotEnabled`, `modelNotReady`, `unavailable`). With no
  arguments it reads `{"question","options":[{"id","description"}],"context"?}` on stdin and prints
  `{"choice","why"}`, or `{"error"}` with exit code 1. `choice` is held to the option ids by a
  `DynamicGenerationSchema`. One process per decision; about 0.1 s for `--check` and under 2 s for a decision on
  an M-series Mac.
- `@helenite/local-llm`: the `apple` runtime kind. The package never starts a process: the app passes
  `apple: { check(), run(request, { signal }) }` to `createLocalLlm`. Left out (Windows, Linux, tests), the
  runtime is never found. The harness applies `timeoutMs` itself and aborts `signal`.
- `apps/desktop/src/main/local-llm/apple-model.ts`: finds the helper (`HELENITE_APPLE_LLM`, then
  `Resources/local-llm-apple/` in a packaged app, then `packages/local-llm-apple/build/`) and runs it. No helper,
  or a model that is not available, means the runtime is "not there"; it is never an error.

Build the helper for a dev run with `pnpm -C packages/local-llm-apple build`. It needs the macOS 26 SDK (Xcode 26
or its Command Line Tools) and prints why and exits 0 anywhere it can't build. The binary is universal, weak-links
FoundationModels and targets macOS 13, so it starts on an older macOS or an Intel Mac and reports the model as
unavailable. `pnpm package` builds it and stages it beside the asar; electron-builder signs it with the app (see
`packaging/SIGNING.md`).

Try it by hand:

```bash
echo '{"question":"Is this plugin only cosmetic?","options":[{"id":"yes","description":"Changes only appearance"},{"id":"no","description":"Adds a feature"}],"context":"Adjust theme CSS variables."}' | packages/local-llm-apple/build/helenite-apple-llm
```

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
