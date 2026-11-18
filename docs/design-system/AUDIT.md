# Design-system audit: what still hand-builds UI

Branch `claude/design-system`, read-only survey (2026-11-18). Paths are relative to the repo root. "DS" = the design system:
`@helenite/ui` (`packages/ui/src`), the host parts in `packages/obsidian-api/src/ui/design/` and `src/ui/scope-bar.ts`,
exposed as `ui` from `helenite` (`packages/obsidian-api/src/helenite-module.ts`). Sizes: S = under an hour, mostly a
swap; M = a few hours, some restructuring or test updates; L = a day or more, or blocked on a missing part.

Existing parts referenced below, with their definitions:

| Part | Where |
| --- | --- |
| `ui.button` | packages/ui/src/button.ts:23 |
| `ui.segmented` | packages/ui/src/segmented.ts:10 |
| `ui.table` | packages/ui/src/table.ts:33 |
| `ui.emptyState / loadingState / errorState` | packages/ui/src/states.ts:13 / :17 / :23 |
| `ui.badge / statusDot` | packages/ui/src/states.ts:31 / :35 |
| `ui.confirm / prompt / choose / form` | packages/obsidian-api/src/ui/design/modals.ts:66 / :82 / :157 / :166 |
| `ui.menu / moreButton` | packages/obsidian-api/src/ui/design/menu.ts:9 / :35 |
| `ui.notice` | packages/obsidian-api/src/ui/design/notice.ts:3 |
| `ui.action`, `STANDARD_ACTIONS` | packages/obsidian-api/src/ui/design/actions.ts:21 / :9 |
| `ui.settings.section / summaryRow / subpageRow / openSubpage` | packages/obsidian-api/src/ui/design/settings.ts:14 / :26 / :46 / :53 |
| `ui.settings.scopeBar` | packages/obsidian-api/src/ui/scope-bar.ts:4 |
| ui-kit (frame only): `tabs`, `textInput`, `searchInput`, `select`, `checkbox`, `field`, `toolbar`, `picker`, `cardGrid` | packages/ui-kit/src/components/tabs.ts:7, controls.ts:3/17/22/29/36/44, picker.ts:10, cards.ts:33 |

Note on imports: only plugins can `import { ui } from 'helenite'`. `packages/accounts-ui`, `packages/connectors`,
`apps/desktop/src/renderer` and `packages/plugin-permissions` are bundled into the host and should import
`@helenite/ui` and `@helenite/obsidian-api/ui/design/*` directly.

## Survey scope and totals

- Units surveyed: 37. All 30 folders under `plugins/` plus `packages/accounts-ui`, `packages/connectors/src/ui`,
  `packages/obsidian-api/src/ui` (non-design files), `packages/obsidian-api/src/*.ts` notices, `packages/apps-runtime/src/host`,
  `packages/plugin-permissions`, `packages/ui-kit`, `apps/desktop/src/renderer`. (`packages/editor`, `markdown-render`,
  `app-jobs`, `harnesses`, `importer` draw no UI; `importer` has only types for the modal UI.)
- Hand-built instances recorded in section 1: **167** table rows, of which **160** should migrate and 7 are marked "keep" (Obsidian-native DOM or public API). A row is one place in code, or one group of identical calls (for example a unit's notices).
- Raw counts across the surveyed sources (lines, excluding tests, the design files and obsidian-api's own Obsidian-API
  classes): 99 `new Notice(`, 26 `extends Modal` / `new Modal(` / `SuggestModal`, 14 `new Menu(`, 46 hand-made
  `<button>` elements, 63 `addButton` calls, 29 raw `input/select/textarea` elements.
- One-off plugin-prefixed CSS classes per stylesheet (distinct `.helenite-*`, or plugin-prefixed `apps-*`,
  `latest-files-*`, `importer-*`):

| Stylesheet | Classes | What they style |
| --- | --- | --- |
| plugins/core-setup/styles.css (173 lines) | 36 | wizard shell (side, steps, main, foot), field/label/input/hint/error, segmented (`-seg`), radio rows (`-row`, `-radio`, `-row-*`), tag, status, link buttons, inline field+button, asks list |
| plugins/obsidian-companion/styles.css | 35 | card, head, badge, pill, chip, option list, key/value field, pre, plan, links, app row (Obsidian-only plugin) |
| plugins/core-ask-widgets/styles.css | 30 | question card (pending/permission/resolved states), header, progress, option rows, key hint, chip, number pill, error, footer, inline confirm, preview, context quote |
| packages/accounts-ui/src/styles.ts (CSS in TS) | 15 | account card, status line ok/bad, icon, vaults checkbox list, notes, git capability checkboxes |
| plugins/core-terminal/styles.css (342 lines; 289 are vendored xterm) | 20 | terminal host, status dot (5 states + pulse), find bar, new-session composer (box, textarea, send, bar, pickers, checkbox), harness card/status/key |
| plugins/core-chats/styles.css | 19 | sidebar list rows with hover actions, collapsible group header with count, status dot (busy/waiting), selection popover with textarea |
| plugins/core-settings/styles.css | 19 `helenite-*` (+11 `hel-*` gallery) | div-grid scope/policy table, inventory bar, plugin row, vault checkbox list, action link |
| plugins/core-agent-inbox/styles.css | 11 | banner, count badge with pulse, tab badge, inbox list rows |
| plugins/core-plugin-browser/styles.css | 10 | modal width, tabs, list rows (name/sub), compat pill (4 tones), error, trust warning |
| plugins/core-hotkeys/styles.css | 4 | div-grid table (row/head/cell) |
| apps-runtime host `HOST_CSS` (packages/apps-runtime/src/host/dialogs.ts:86) | 9 (+ `ha-dialog*`) | own modal backdrop/box, permission lists, button row |
| plugins/core-apps/styles.css | 4 (`apps-entry*`) | list row, inline editor, field |
| plugins/core-latest-files/styles.css | 4 (`latest-files-*`) | tabs, list row meta |
| plugins/core-properties/styles.css | 2 | chip, collapsible frontmatter (rest is Obsidian `metadata-*`) |
| plugins/core-importer/styles.css | 2 (`importer-*`) | checkbox row + note |
| plugins/core-session-sync/styles.css | 1 | status-bar chip |
| plugins/core-file-explorer/styles.css | 0 (1 Obsidian class) | rename input |
| renderer (no stylesheet in repo; classes set in TS) | 16 | connector review (`helenite-review-*`), diff bar, host prompt |

Plugins with nothing to migrate: `sample-design-system` (already on `ui`), `core-session-sync` (status-bar text only),
`core-command-palette`, `core-switcher`, `core-vault-switcher`, `core-app-host` (Obsidian `SuggestModal` fuzzy pickers,
main.ts:30 / :10 / :42 / :89; keep them: the DS has no fuzzy picker and `SuggestModal` is the Obsidian-native look). Only
their `new Notice` calls (vault-switcher main.ts:73, :82; app-host main.ts:41, :54) move to `ui.notice`.

---

## 1. Per plugin / package: hand-built UI and its replacement

### packages/accounts-ui (shared by all account plugins)

| Hand-built | Where | Replace with | Size |
| --- | --- | --- | --- |
| Account card: bordered block headed by a `Setting` with icon, status line, label text box | home-tab.ts:57-62, styles.ts:2-8 | missing `ui.settings.card` (+ `statusText`) | M |
| Status line coloured `is-ok` / `is-bad` | home-tab.ts:61, :94 | missing `ui.statusText` (or `badge` with a `warning` tone) | S |
| "Add account" CTA on a heading row | home-tab.ts:48 | `ui.settings.section` + `ui.button` primary (or new `add` action) | S |
| "Reconnect" / "⚠ Reconnect" buttons | home-tab.ts:85-88 | `ui.button` (new `reconnect` action) | S |
| Remove (warning) button | home-tab.ts:101 | missing `remove` standard action (`delete` copy says "cannot be undone", wrong here) | S |
| "Vaults: …" button opening a checked-item menu | home-tab.ts:120-124, vault-picker.ts:23-50 | missing `ui.menuButton` + `checked` on `MenuItemSpec` | M |
| "Reset" denied-vault button | home-tab.ts:140 | `ui.action(el, 'reset')` | S |
| Empty text "No accounts yet." | home-tab.ts:52 | `ui.emptyState` (needs an inline variant, see Risks) | S |
| Error text "Could not load accounts" | settings-tab.ts:43 | `ui.errorState` (inline variant) | S |
| Vault access picker: dropdown + checkbox per vault | access-picker.ts:37-75 | missing `ui.settings.vaultScope` | M |
| `AddAccountModal`: list of types with an Add button each | add-account-modal.ts:8-27 | `ui.choose` (options with `detail`; icon unsupported) | M |
| `ConnectModal`: hosts a type's connect form | add-account-modal.ts:30-64 | missing `ui.dialog` (custom body) | M |
| `ConfirmRemoveModal` | add-account-modal.ts:67-82 | `ui.confirm` danger | S |
| `ConfirmModal` (yes/no) | add-account-modal.ts:85-115 | `ui.confirm` | S |
| Vault-tab buttons: Open Home settings / Add account / Remove | vault-tab.ts:20, :24, :68 | `ui.action('editInHome')`, `ui.button` primary, `remove` action | S |
| Empty texts in vault tab | vault-tab.ts:33, :46 | `ui.emptyState` inline | S |
| Git connect form: capability checkboxes | git.ts:66-74 | missing `ui.checkList` | M |
| Git token: password `Setting.addText` + Connect CTA + validation notices | git.ts:85-112 | missing `ui.field` / `ui.textInput({secret})`; validation via `ui.form` once it supports `message` + `multi` | M |
| `ReplaceTokenModal` | git.ts:116-122 | missing `ui.dialog` | S |
| "Add permission…" button + menu | git.ts:161-168 | missing `ui.menuButton` | S |
| 10 `new Notice(errorMessage(e))` | home-tab.ts:44, :102; vault-tab.ts:21, :22, :38, :48; add-account-modal.ts:50; git.ts:95, :98, :110 | `ui.notice(…, {kind:'error'})` | S |

### core-account-apple / core-account-imap (same code shape)

| Hand-built | Where | Replace with | Size |
| --- | --- | --- | --- |
| Raw checkbox inside a `Setting` (Mail / Calendar) | apple main.ts:72-78, imap main.ts:81-87 | missing `ui.checkList` (or `ui.toggle`) | S |
| Connect/Reconnect CTA | apple :52, imap :60 | `ui.button` primary | S |
| `ReconnectModal` hosting the password form | apple :80-93, imap :90-103 | missing `ui.dialog` | S |
| "⚠ Reconnect" header button | apple :110, imap :118 | `ui.button` (new `reconnect` action) | S |
| "Add permission…" menu button | apple :117-124, imap :125-130 | missing `ui.menuButton` | S |
| Notices | apple :54, :63; imap :62, :71 | `ui.notice` error | S |

### core-account-google

| Hand-built | Where | Replace with | Size |
| --- | --- | --- | --- |
| Connect Google CTA | main.ts:32 | `ui.button` primary | S |
| "⚠ Reconnect" + "Add permission…" menu | main.ts:54, :58-63 | `reconnect` action, missing `ui.menuButton` | S |
| Notices | main.ts:36, :43 | `ui.notice` | S |

### core-account-aws

| Hand-built | Where | Replace with | Size |
| --- | --- | --- | --- |
| Profile list as Settings rows with "Choose" | main.ts:32-34 | `ui.table` with an `open`-style action, or `ui.choose` | S |
| Empty text "No profiles found" | main.ts:32 | `ui.emptyState` inline | S |
| Two-button choice (Move and enforce / Add without enforcing) | main.ts:55-58 | `ui.button` x2 | S |
| `AwsRemoveModal`: message + two toggles + async Remove that stays open on error | main.ts:62-95 | `ui.form` (danger) once it has `message` and an async `onSubmit`; until then missing `ui.dialog` | M |
| `RepairModal`: async danger confirm | main.ts:98-120 | `ui.confirm` with missing async `onConfirm` | S |
| Header buttons Repair / Sign in | main.ts:142, :146 | `ui.button` | S |
| Notices (incl. 15 s backups) | main.ts:28, :49, :52, :90, :115, :124 | `ui.notice` (`timeoutMs`) | S |

### core-account-gcp

| Hand-built | Where | Replace with | Size |
| --- | --- | --- | --- |
| Sign-in / Enforce / Not now buttons | main.ts:27, :46, :56 | `ui.button` | S |
| `GcpRemoveModal`, `RepairModal`: async danger confirms | main.ts:60-85, :114-136 | `ui.confirm` + async `onConfirm` | S |
| `GcpEnforceModal`: message + ADC choice + async CTA | main.ts:88-111 | `ui.form` (+ `message`, async) or `ui.dialog` | M |
| Header buttons Repair / Enforce… | main.ts:167, :172 | `ui.button` | S |
| Notices | main.ts:33, :52, :80, :106, :131, :139 | `ui.notice` | S |

### core-account-github / core-account-gitlab

No UI of their own; they use `packages/accounts-ui/src/git.ts` (above). Only the logo. Nothing to migrate.

### sample-letterboxd-account

| Hand-built | Where | Replace with | Size |
| --- | --- | --- | --- |
| Connect form: raw input + `p.mod-warning` error + CTA | accounts.ts:66-69 | missing `ui.field` + `ui.textInput`, `ui.button` primary | S |
| Notices | main.ts:37, :44 | `ui.notice` | S |

### core-settings (partly migrated)

| Hand-built | Where | Replace with | Size |
| --- | --- | --- | --- |
| Div-grid table `helenite-scope-table` / `helenite-policy-table` (head row + cells) | plugin-policy-ui.ts:149-175 | `ui.table` (column `cell` callbacks) | M |
| Checkbox per vault (`helenite-default-vault`) + empty text | plugin-policy-ui.ts:109-120 | missing `ui.settings.vaultScope` / `ui.checkList` | M |
| "Unreadable" error line | plugin-policy-ui.ts:146 | missing `ui.callout` (warning) | S |
| "Update to vX" button with manual busy flag | community-home.ts:201-210 | `ui.button` (async `onClick` gives busy for free) | S |
| Empty/error lines as `setting-item-description` | community-home.ts:135, :149; across-vaults.ts:156, :209, :211 | `ui.emptyState` / `ui.errorState` inline variant | S |
| Followers menu opened at a point in the note's own document | scope-table.ts:88-91 | `ui.menu` (needs a `doc` option for popouts / the settings OS window) | S |
| Notices | community-home.ts:90, :108, :118, :125; plugin-rows.ts:54; plugin-policy-ui.ts:97 | `ui.notice` error | S |

### core-terminal

| Hand-built | Where | Replace with | Size |
| --- | --- | --- | --- |
| Harness card (`helenite-harness-card`): bordered block headed by a Setting with icon | harness-cards.ts:21-28 | missing `ui.settings.card` | M |
| Status line ok/bad/neutral | harness-cards.ts:31-34 | missing `ui.statusText` | S |
| Vault scope: dropdown All/Off/Specific + toggle per vault | harness-cards.ts:41-67 | missing `ui.settings.vaultScope` | M |
| "Edit in Secrets" action link (`helenite-setting-action`) | harness-cards.ts:96-97 | `ui.button` link variant (or a new `editIn` action) | S |
| Pending approvals: Approve CTA / Deny buttons | home-harnesses-tab.ts:58-66 | `ui.button` primary + default | S |
| "Open in Home" button | home-harnesses-tab.ts:84 | `ui.action('editInHome')` | S |
| `RequestHarnessModal`: 3 text fields + submit | request-harness-modal.ts:17-49 | `ui.form` | S |
| Empty/error text | home-harnesses-tab.ts:47; settings.ts:65; harness-cards.ts:66 | `ui.emptyState` / `ui.errorState` inline | S |
| Find bar: raw input + 3 clickable-icon buttons | search-bar.ts:9-15 | missing `ui.searchInput` + `ui.button` icon | S |
| Tab-header status dot, 5 states with pulse | view.ts:103, styles.css:296-302 | `ui.statusDot` (needs `warning` tone + `pulse`) | S |
| New-session composer: textarea + round send button | new-session-view.ts:52-61 | missing `ui.composer` | M |
| Composer bar: worktree checkbox, hidden-`select` pickers | new-session-view.ts:62-90 | missing `ui.toggle` / `ui.dropdown` (compact variant) | M |
| Chat-provider cards: rows of text/dropdown/"Use" button | chat-cards.ts:39-47, :108-145 | `ui.settings.card` + standard rows | M |
| Notices | main.ts:227, :260, :276, :301, :311; home-harnesses-tab.ts:24, :60, :64; request-harness-modal.ts:37, :40, :43 | `ui.notice` | S |

### core-setup (biggest hand-built set: its own mini design system in ui.ts)

| Hand-built | Where | Replace with | Size |
| --- | --- | --- | --- |
| `field()` label wrapper | ui.ts:26-31 (used step-home.ts:10-11, step-policy.ts:35, step-blank.ts:11-12, step-obsidian.ts:14, step-template.ts:19) | missing `ui.field` | M |
| `segmented()` radiogroup | ui.ts:33-41 (step-home.ts:10, step-policy.ts:35) | `ui.segmented` | S |
| `radioRow()` selectable rows with radio dot, icon, tag, detail | ui.ts:43-65 (step-harnesses.ts:26, :39; step-start.ts:16) | missing `ui.choiceList` | M |
| `toggle()` hand-made Obsidian switch | ui.ts:67-76 (step-policy.ts:32) | missing `ui.toggle` | S |
| `textInput()` | ui.ts:78-83 (6 call sites) | missing `ui.textInput` | S |
| Status pill "Found / Custom / Always" | step-harnesses.ts:28, :41 | `ui.badge` (`success`) | S |
| Link-style buttons "+ Add a custom harness command", "↻ Scan again" | step-harnesses.ts:45, :52 | `ui.button` link variant | S |
| `CustomHarnessModal` (two inputs + Add) | step-harnesses.ts:69-92 | `ui.form` | S |
| Wizard footer Back / Continue | wizard-view.ts:67-68 | `ui.button` default + primary | S |
| Wizard side step list | wizard-view.ts:61-63 | (no part; see "steps" under Missing parts, deferred) | - |
| Inline errors `helenite-setup-error` (aria-live) | wizard-view.ts:78; dialog.ts:57; step-blank.ts:15; step-template.ts:23; step-obsidian.ts:25 | missing `ui.field` error slot / `ui.callout` danger | S |
| Hint "no session" | dialog.ts:113 | missing `ui.callout` info | S |
| `NewVaultDialog`: multi-step modal with Back/Cancel/Continue | dialog.ts:34-135 | missing `ui.dialog` (with actions) | L |
| Inline field + button rows ("Choose…", "Get template") | step-obsidian.ts:15-24; step-template.ts:20-22 | missing `ui.field` + `ui.button` | S |
| Notices | main.ts:97, :103; wizard-view.ts:179; step-harnesses.ts:57, :88; dialog.ts:131 | `ui.notice` | S |

### core-plugin-browser

| Hand-built | Where | Replace with | Size |
| --- | --- | --- | --- |
| Tabs as buttons, active one `mod-cta` | browser-modal.ts:52-59 | missing `ui.tabs` (or `ui.segmented`) | S |
| Search via `Setting.addText` | browser-modal.ts:61-65 | missing `ui.searchInput` | S |
| Result rows: name, sub line, compat pill, action button | browser-modal.ts:136-145 | `ui.table` (or missing `ui.listRow`) + `ui.badge` | M |
| Compat pill with works/partial/broken tones | browser-modal.ts:140, styles.css:8-11 | `ui.badge` (needs `warning` tone) | S |
| Loading lines | browser-modal.ts:81, :102, :117 | `ui.loadingState` | S |
| Empty lines | browser-modal.ts:92, :113, :128 | `ui.emptyState` | S |
| Error line | browser-modal.ts:174-177 | `ui.errorState(el, msg, retry)` | S |
| Enable button with manual disabled/busy | browser-modal.ts:150-171 | `ui.button` async `onClick` | S |
| `PluginBrowserModal` shell | browser-modal.ts:21 | keep `Modal`, or missing `ui.dialog` | - |
| Trust modal: warning paragraph + extra lines + danger Install | trust-modal.ts:16-30 | `ui.confirm` danger (needs multi-paragraph message or a `warning` callout) | S |
| Notices | browser-modal.ts:164, :194, :196; updater.ts:20, :24, :57 | `ui.notice` | S |

### core-hotkeys

| Hand-built | Where | Replace with | Size |
| --- | --- | --- | --- |
| Div-grid table (Command / Home / All vaults) | home-table.ts:20-32, styles.css:4-7 | `ui.table` | M |
| Search box via `Setting.addSearch` | tab.ts:42 | missing `ui.searchInput` | S |
| Reset icon (`rotate-ccw`) as `ExtraButtonComponent` | tab.ts:107 | `ui.action('reset')` (icon, not link: needs a variant option) | S |
| Hotkey chips `.setting-hotkey` with delete × | tab.ts:93-99 | keep (Obsidian-native class; themes style it) | - |
| Notices | main.ts:170, :213 | `ui.notice` | S |

### core-chats

| Hand-built | Where | Replace with | Size |
| --- | --- | --- | --- |
| Pane header with one icon action (Group by) | view.ts:31-34 | missing `ui.paneHeader` | S |
| "Group by" menu with checked items | view.ts:44-50 | `ui.menu` (needs `checked`) | S |
| Collapsible group header with chevron + count | view.ts:77-83 | missing `ui.listGroup` (part of `listRow` batch) | M |
| Session row: dot, title, meta, hover icon actions, context menu | view.ts:97-115 | missing `ui.listRow` + `ui.statusDot` + `ui.menu` | M |
| Status dot busy/waiting (pulse) | view.ts:99, styles.css:1-3 | `ui.statusDot` (+ `warning`, `pulse`) | S |
| Tab-header count badge | view.ts:89-93 | missing `ui.countBadge` | S |
| Empty pane text `pane-empty` | view.ts:59 | `ui.emptyState` (pane variant) | S |
| Selection popover: quote + textarea + hint | selection.ts:38-48 | missing `ui.composer` (popover itself stays) | M |
| Notices | main.ts:96, :98, :109, :118 | `ui.notice` | S |

### core-apps

| Hand-built | Where | Replace with | Size |
| --- | --- | --- | --- |
| Pane header: two icon actions | view.ts:26-35 | missing `ui.paneHeader` | S |
| Entry row with icon, title, "not installed" tag, context menu | view.ts:57-75 | missing `ui.listRow` + `ui.menu` (Remove = danger item) | M |
| Inline editor: three labelled inputs + Save/Cancel | view.ts:93-117 | missing `ui.field`/`ui.textInput` + `ui.button`; or `ui.form` modal | M |
| Empty pane text | view.ts:48 | `ui.emptyState` pane variant | S |
| Notices | main.ts:69, :81, :86; view.ts:105 | `ui.notice` | S |

### core-latest-files

| Hand-built | Where | Replace with | Size |
| --- | --- | --- | --- |
| Header tabs (Opened / Modified) as clickable divs | main.ts:33-41 | missing `ui.tabs` (or `ui.segmented`) | S |
| File rows with meta line | main.ts:64-71 | missing `ui.listRow` | S |
| Empty pane text | main.ts:56 | `ui.emptyState` pane variant | S |

### core-agent-inbox

| Hand-built | Where | Replace with | Size |
| --- | --- | --- | --- |
| Count badge with pulse (tab, ribbon) | ui.ts:5-11 | missing `ui.countBadge` | S |
| Accent banner with text + "Answer now" CTA | ui.ts:13-22 | missing `ui.callout` (accent, with action) | S |
| Inbox rows: kind, note, Open button | view.ts:29-35 | missing `ui.listRow` | S |
| Empty pane text | view.ts:27 | `ui.emptyState` pane variant | S |

### core-ask-widgets

| Hand-built | Where | Replace with | Size |
| --- | --- | --- | --- |
| Question card shell with pending/permission/resolved states | card.ts:79-105, styles.css:2-11 | missing `ui.card` (tones) | L |
| Option buttons (radio/checkbox roles, key hint, recommended, desc, preview) | card.ts:136-146 | missing `ui.choiceList` (multi + key hints) | L |
| "Other…" input, text/textarea answers | card.ts:130, :148 | missing `ui.textInput` / `ui.composer` | S |
| Header chip and number pill | card.ts:121-122 | missing `ui.chip`; `ui.badge` accent | S |
| Footer Dismiss / Submit | card.ts:101-104 | `ui.button` | S |
| Inline "Dismiss? (Enter) / Keep (Esc)" confirm | card.ts:216-219 | `ui.button` danger + default (stays inline; not a modal) | S |
| Error line, context quote | card.ts:96, :91 | missing `ui.callout` | S |

### core-chat-providers

| Hand-built | Where | Replace with | Size |
| --- | --- | --- | --- |
| Header: raw `select.dropdown`, New chat / Stop buttons, status text | chat-view.ts:26-32 | missing `ui.dropdown` + `ui.button` + `ui.statusText` | S |
| Composer textarea + Send CTA | chat-view.ts:34-37 | missing `ui.composer` | S |
| Notices | chat-view.ts:51, :58 | `ui.notice` | S |

### core-file-explorer

| Hand-built | Where | Replace with | Size |
| --- | --- | --- | --- |
| `confirmDelete`: bare `Modal` with Delete/Cancel | main.ts:8-27 | `ui.confirm` danger (not `action('delete')`: the file goes to trash) | S |
| Pane header icon actions | main.ts:52-58 | missing `ui.paneHeader` | S |
| Context menus | main.ts:62, :214 | `ui.menu` | S |
| Inline rename input | main.ts:233 | keep (Obsidian-native `file-explorer-rename-input`) | - |
| Notices | main.ts:204, :248, :249 | `ui.notice` | S |

### core-importer

| Hand-built | Where | Replace with | Size |
| --- | --- | --- | --- |
| `ChoiceModal` + checkbox rows with notes + Cancel/primary bar | modals.ts:4-28 | `ui.form` with missing `multi` field kind (+ per-option `detail`) and `message` | M |
| Review and keychain dialogs built on it | modals.ts:30-58 | same | (in above) |
| Notices | main.ts:35, :38 | `ui.notice` (success / error) | S |

### core-build

| Hand-built | Where | Replace with | Size |
| --- | --- | --- | --- |
| `checkVaults`: intro + checkbox per vault + `<details>` notes + OK/Cancel | default-change.ts:36-72 | `ui.form` with `multi` + `message`; the `<details>` list has no part | M |
| Notices | default-change.ts:113, :117 | `ui.notice` error | S |

### core-properties

| Hand-built | Where | Replace with | Size |
| --- | --- | --- | --- |
| "Open as source" CTA | main.ts:109 | `ui.button` primary | S |
| Property context menu | render.ts:217 | `ui.menu` | S |
| Value chips `helenite-chip` | main.ts:331-334 | missing `ui.chip` (careful: sits inside Obsidian `metadata-*` DOM) | S |
| Metadata editor inputs (`metadata-input`, `multi-select-input`) | render.ts:67-142, :229 | keep (Obsidian-native DOM that themes target) | - |
| Notice | main.ts:129 | `ui.notice` | S |

### obsidian-companion

Runs only inside real Obsidian (manifest id `helenite-companion`), where `require('helenite')` throws. Its 35 classes
(styles.css) mirror card/chip/pill/option/key-value patterns but should stay hand-built, or use the guarded-require
fallback from the README if the parts are ever made available there. Not counted as migration work.

### packages/connectors/src/ui (Secrets and Data settings tabs)

| Hand-built | Where | Replace with | Size |
| --- | --- | --- | --- |
| Key access: dropdown + toggle per vault | secrets-tab.ts:78-100 | missing `ui.settings.vaultScope` | M |
| Password text + Save/Replace CTA + Remove warning | secrets-tab.ts:119-127 | missing `ui.textInput({secret})`; `remove` action | S |
| Heading rows | secrets-tab.ts:54, :103-111; data-tab.ts:77 | `ui.settings.section` | S |
| Move up / Move down / Remove / Review buttons | data-tab.ts:85-88 | missing `moveUp`/`moveDown`/`remove` actions; `ui.action('open')` | S |
| "Add a connector" dropdown + Add CTA | data-tab.ts:94-97 | `Setting` stays; `ui.button` primary | S |
| Notices | secrets-tab.ts:78, :121, :122, :126; data-tab.ts:59 | `ui.notice` | S |

### packages/obsidian-api/src (non-design parts used by core)

| Hand-built | Where | Replace with | Size |
| --- | --- | --- | --- |
| Home summary `<table>` (Setting / Home / Vault Defaults, `is-different` rows) | ui/override-list.ts:87-97 | `ui.table` | S |
| "text · link" action links (Reset, Use Defaults again, Edit in Home) | ui/override-list.ts:43-49, :109-120 | `ui.action('reset' / 'useDefault' / 'editInHome')` | S |
| Notices | ui/override-list.ts:35, :60; plugin-settings-host.ts:118 | `ui.notice` | S |
| Notice with an inline action link | plugin-separate-notice.ts:5-14 | `ui.notice` with missing `action` option | S |
| `ConfirmationModal` / `ConfirmationButton` (Obsidian API compat) | ui/confirmation.ts:6, :52 | keep: public Obsidian API surface | - |
| `TemplatePicker` fuzzy modal | compat/core-notes.ts:24 | keep (`FuzzySuggestModal`) | - |

### apps/desktop/src/renderer

| Hand-built | Where | Replace with | Size |
| --- | --- | --- | --- |
| `HostPrompt` Block/Allow modal | data-attention.ts:12-31 | `ui.confirm` (cancel = "Block") only if Escape may mean Block; see Risks | S |
| Clickable review notice | data-attention.ts:59-60 | `ui.notice` with missing `onClick`/`action` | S |
| Other notices | data-attention.ts:51, :64; vault-rail.ts:36; bootstrap.ts:92, :174; connector-review.ts:155 | `ui.notice` | S |
| Connector review: error box, empty lines, section lists, "show diff" toggle, Reject/Approve bar | connector-review.ts:41-100, :150 | missing `ui.callout`, `ui.keyValue`; `ui.emptyState`; `ui.button` link/default/primary | M |
| Diff bar: title + Reject/Accept | diff-view.ts:26-30 | `ui.button` (missing `ui.toolbar`) | S |
| Vault rail menus | vault-rail.ts:126, :140 | `ui.menu` | S |
| Rail icon buttons, "more" count badge | vault-rail.ts:44-52, :196 | keep rail chrome; badge → missing `ui.countBadge` | S |

### packages/apps-runtime/src/host (host-drawn dialogs)

| Hand-built | Where | Replace with | Size |
| --- | --- | --- | --- |
| Own modal (`ha-dialog-bg` / `ha-dialog`), not an Obsidian `Modal` | dialogs.ts:39-55, CSS :92-101 | missing `ui.dialog` (it must stay host-drawn and unfakeable; core-app-host passes `app`) | M |
| Permission review: titled lists with "(new)" marking + Allow/Don't allow | dialogs.ts:16-37 | missing `ui.keyValue` (list values) + `ui.button` | M |
| Secret entry: password input + Save/Cancel | dialogs.ts:65-84 | `ui.prompt` with a `secret` option (Field already has `secret`) | S |
| "Review permissions…" retry button in a note | host.ts:87-91 | `ui.errorState(el, msg, retry)` (custom retry label needed) | S |

### packages/plugin-permissions

| Hand-built | Where | Replace with | Size |
| --- | --- | --- | --- |
| DOM-only prompt mimicking Obsidian modal markup (works without `app`, in popouts) | prompt-dom.ts:4-55 | `ui.confirm` needs `app`; needs a doc-only variant of `confirm` or keep as is | M |
| Full-trust warning paragraph, risk-tagged list | prompt-dom.ts:22-34 | missing `ui.callout` warning; list stays | S |

### packages/ui-kit (frame-safe; apps only)

Already a design system for app frames; the gap is the other direction. It owns parts the host lacks:
`tabs` (tabs.ts:7), `textInput` / `searchInput` / `select` / `checkbox` / `field` / `toolbar` (controls.ts:3-44),
`picker` (picker.ts:10), `cardGrid` / `posterRow` (cards.ts:33, :64), `calendarStrip` (calendar.ts:14), all with
`hel-*` classes in ui-kit.css. Most of the missing parts below should be lifted from here into `packages/ui` (with CSS
moved into 06-design-system.css) and re-exported by ui-kit, rather than written twice. Size per part: S-M.

---

## 2. Missing parts

Each part: where the pattern appears (2+ places), proposed API in the existing style, frame-safe (`packages/ui`) or
host-only (`obsidian-api/src/ui/design`), and classes.

### 2.1 `ui.dialog` (custom-body modal shell) - host-only

Seen in: accounts-ui add-account-modal.ts:30 (ConnectModal), git.ts:116; core-account-apple main.ts:80; core-account-imap
main.ts:90; core-account-aws main.ts:62; core-account-gcp main.ts:88; core-setup step-harnesses.ts:69, new-vault/dialog.ts:34;
core-terminal request-harness-modal.ts:17; core-importer modals.ts:14; core-build default-change.ts:40; apps-runtime
dialogs.ts:39; plugin-permissions prompt-dom.ts:4.

```ts
dialog<T>(app, o: { title: string; render: (body: HTMLElement, ctx: { close(v: T | null): void; setBusy(b: boolean): void; setError(msg: string | null): void }) => void | (() => void);
  actions?: { text: string; variant?: ButtonVariant; onClick: (ctx) => unknown }[]; cancel?: string | false; width?: 'default' | 'wide' }): Promise<T | null>
```
Reuses `DesignModal` (modals.ts:10). Classes: `hel-modal is-dialog`, `hel-modal-actions`, `hel-modal-error`; `is-wide`.

### 2.2 Async confirm / form submit - host-only (extension)

Seen in: aws main.ts:83-93, :108-117; gcp main.ts:73-83, :99-109, :124-133; accounts git.ts:93-112 (button disabled while running).
Today `ui.confirm` resolves and closes immediately, so a failing remove closes the modal.

```ts
confirm(app, { …, onConfirm?: () => Promise<void> })   // busy while running; on throw shows the message in hel-modal-error and stays open
form(app, { …, message?: string, onSubmit?: (v) => Promise<void> })
```
Classes: existing `hel-modal-error`, `hel-button.is-busy`.

### 2.3 `ui.callout` (banner / inline message) - frame-safe

Seen in: core-agent-inbox ui.ts:13-22 (accent banner + CTA); core-setup wizard-view.ts:78, dialog.ts:57, :113, step-blank.ts:15,
step-template.ts:23, step-obsidian.ts:25; core-plugin-browser trust-modal.ts:21, browser-modal.ts:176; plugin-permissions
prompt-dom.ts:22; renderer connector-review.ts:48, data-attention.ts:19; core-ask-widgets card.ts:91, :96; core-settings
plugin-policy-ui.ts:146; sample-letterboxd accounts.ts:68.

```ts
callout(parent, o: { tone?: 'info' | 'accent' | 'warning' | 'danger' | 'success'; text: string | DocumentFragment; action?: ButtonOptions; live?: boolean }): { el: HTMLElement; setText(t: string): void; setTone(t): void; hide(): void; show(): void }
```
Classes: `hel-callout is-info|is-accent|is-warning|is-danger|is-success`, `hel-callout-text`, `hel-callout-action`.
`live: true` sets `aria-live="polite"` (the setup error lines rely on it).

### 2.4 `ui.field` + input wrappers (text, toggle, dropdown, slider) - frame-safe

The spec catalogue listed toggle/dropdown/text/slider wrappers that were never built. Seen in: core-setup ui.ts:26 (field),
:67 (toggle), :78 (textInput) with 6+ call sites; core-apps view.ts:95-99; sample-letterboxd accounts.ts:67;
core-ask-widgets card.ts:130, :148; core-chat-providers chat-view.ts:27 (select); core-terminal new-session-view.ts:72
(checkbox), :81 (select); accounts-ui access-picker.ts:58 (DropdownComponent), git.ts:102-107 (password text);
connectors secrets-tab.ts:119 (password); ui-kit controls.ts:3-36 (frame versions). Slider: only core-terminal
settings.ts:75 (via `Setting.addSlider`), so build it last or not at all.

```ts
field(parent, o: { label: string; hint?: string; inline?: boolean }): { el: HTMLElement; control: HTMLElement; setError(msg: string | null): void }
textInput(parent, o: { value?: string; placeholder?: string; secret?: boolean; type?: 'text' | 'number'; label?: string; onInput?: (v) => void; onEnter?: (v) => void }): HTMLInputElement
toggle(parent, o: { value: boolean; label: string; disabled?: boolean; onChange?: (v: boolean) => void }): { el: HTMLElement; setValue(v): void; setDisabled(d): void }
dropdown<T extends string>(parent, o: { options: { value: T; text: string }[]; value?: T; label?: string; compact?: boolean; onChange?: (v: T) => void }): { el: HTMLSelectElement; setValue(v: T): void; setDisabled(d): void }
slider(parent, o: { min: number; max: number; step?: number; value: number; label: string; onChange: (v) => void }): HTMLInputElement   // optional
```
Classes: `hel-field`, `hel-field-label`, `hel-field-hint`, `hel-field-error`, `hel-field.is-inline`; `hel-input`
(+ `is-secret`); toggle emits Obsidian's `checkbox-container` (+ `is-enabled`) so themes keep styling it, plus `hel-toggle`;
`hel-select dropdown` (+ `is-compact`). These classes already exist in ui-kit.css.

### 2.5 `ui.checkList` (multi-choice checkboxes) + `form` field kind `multi` - frame-safe

Seen in: accounts-ui git.ts:66-74, access-picker.ts:42-52; core-account-apple main.ts:72; core-account-imap main.ts:81;
core-importer modals.ts:4-12 (with a note per row); core-build default-change.ts:44-49; core-settings plugin-policy-ui.ts:109-118.

```ts
checkList<T extends string>(parent, o: { options: { value: T; text: string; detail?: string; disabled?: boolean }[]; value: T[]; label?: string; onChange?: (v: T[]) => void }): { el: HTMLElement; value(): T[]; setValue(v: T[]): void }
// Field: | { id; kind: 'multi'; label?: string; value?: string[]; options: { value; label; detail?; disabled? }[] }
```
Classes: `hel-check-list`, `hel-check` (exists in ui-kit), `hel-check-detail`, `is-disabled`.

### 2.6 `ui.card` and `ui.settings.card` - card is frame-safe, settings card host-only

Seen in: accounts-ui home-tab.ts:57 + styles.ts:2; core-terminal harness-cards.ts:21; core-ask-widgets card.ts:79 +
styles.css:2-11; obsidian-companion styles.css:2-14 (`helenite-card` with status tones); ui-kit cards.ts:33 (`hel-card`).

```ts
card(parent, o: { title?: string; icon?: string; tone?: 'default' | 'accent' | 'warning' | 'muted'; compact?: boolean }): { el: HTMLElement; head: HTMLElement; body: HTMLElement; setTone(t): void }
settings.card(parent, o: { name: string; desc?: string; icon?: string; status?: { text: string; tone: Tone | 'warning' } }): { el: HTMLElement; head: Setting; body: HTMLElement; setStatus(s): void }
```
Classes: `hel-card`, `hel-card-head`, `hel-card-body`, `is-accent|is-warning|is-muted|is-compact`; `hel-settings-card`.

### 2.7 `ui.statusText` + `warning` tone + dot pulse (extensions to states.ts) - frame-safe

Seen in: accounts-ui home-tab.ts:61, :94 (`is-ok`/`is-bad`); core-terminal harness-cards.ts:31 (`is-ok`/`is-bad`/`is-neutral`);
core-setup step-harnesses.ts:28; core-plugin-browser browser-modal.ts:140 (works/partial/broken); core-chat-providers
chat-view.ts:32. Dots with pulse: core-terminal view.ts:103 + styles.css:296-302; core-chats view.ts:99 + styles.css:1-3.

```ts
type Tone = 'default' | 'accent' | 'danger' | 'success' | 'warning'
statusText(parent, text: string, tone: Tone): HTMLElement
statusDot(parent, tone, label, o?: { pulse?: boolean }): HTMLElement   // existing signature + options
```
Classes: `hel-status-text is-<tone>`, `hel-badge.is-warning`, `hel-status-dot.is-warning`, `hel-status-dot.is-pulse`.

### 2.8 `ui.countBadge` - frame-safe

Seen in: core-agent-inbox ui.ts:5-11 (+ pulse); core-chats view.ts:89-93; renderer vault-rail.ts:196; ui-kit
`hel-tab-badge`.

```ts
countBadge(parent, n: number, o?: { max?: number; pulse?: boolean; label?: string }): { el: HTMLElement; set(n: number): void }   // hides at 0, shows "9+" above max
```
Classes: `hel-count-badge`, `is-pulse`.

### 2.9 `ui.tabs` - frame-safe (lift from ui-kit)

Seen in: core-latest-files main.ts:33-41; core-plugin-browser browser-modal.ts:52-59; ui-kit tabs.ts:7.

```ts
tabs<T extends string>(parent, o: { tabs: { id: T; text: string; badge?: number }[]; value: T; onSelect: (id: T) => void }): { el: HTMLElement; setValue(id: T): void; setBadge(id: T, n: number): void }
```
Classes (ui-kit already): `hel-tabs`, `hel-tab`, `hel-tab-badge`, `is-active`.

### 2.10 `ui.searchInput` - frame-safe (lift from ui-kit)

Seen in: core-hotkeys tab.ts:42; core-plugin-browser browser-modal.ts:61; core-terminal search-bar.ts:10; ui-kit
controls.ts:17.

```ts
searchInput(parent, o: { placeholder?: string; value?: string; delayMs?: number; onSearch: (q: string) => void }): HTMLInputElement
```
Classes: `hel-input hel-search` (wrap in Obsidian `search-input-container` so themes keep the clear button look).

### 2.11 `ui.choiceList` (inline single/multi option rows) - frame-safe

Seen in: core-setup ui.ts:43-65 (radio rows, 3 call sites); core-ask-widgets card.ts:136-146; obsidian-companion
`.helenite-option`; ui.choose's own rows (modals.ts, `hel-modal-choice`); ui-kit picker.ts:10 (`hel-option`).

```ts
choiceList<T extends string>(parent, o: { options: { value: T; text: string; detail?: string; icon?: string; tag?: string; disabled?: boolean; key?: string }[]; value?: T | T[]; multi?: boolean; label?: string; onChange: (v) => void }): { el; setValue(v): void }
```
Classes: `hel-choice-list`, `hel-choice`, `hel-choice-detail`, `hel-choice-key`, `is-selected`, `is-disabled`, `is-multi`
(then `hel-modal-choice` in `ui.choose` can render through it).

### 2.12 `ui.listRow` / `ui.listGroup` / `ui.paneHeader` (sidebar pane lists) - listRow frame-safe, paneHeader host-only

Seen in: core-chats view.ts:31-34, :77-83, :97-115; core-apps view.ts:26-35, :57-75; core-latest-files main.ts:64-71;
core-agent-inbox view.ts:29-35; core-file-explorer main.ts:52-58; core-plugin-browser browser-modal.ts:136-145 (row with
action in a modal).

```ts
paneHeader(contentEl, actions: { icon: string; label: string; onClick: (e: MouseEvent) => void }[]): HTMLElement
listRow(parent, o: { title: string; icon?: string; meta?: string; tag?: string; active?: boolean; dot?: { tone: Tone; label: string; pulse?: boolean };
  actions?: { icon: string; label: string; onClick: () => void }[]; onClick?: (e: MouseEvent) => void; menu?: () => MenuItemSpec[] }): HTMLElement
listGroup(parent, o: { title: string; count?: number; collapsed?: boolean; onToggle?: (c: boolean) => void }): { el: HTMLElement; body: HTMLElement }
```
Classes: emit Obsidian `nav-header`/`nav-buttons-container`/`nav-action-button`/`nav-file`/`nav-file-title`/`nav-file-tag`
(themes style these) plus `hel-list-row`, `hel-list-row-meta`, `hel-list-row-actions`, `hel-list-group`, `is-active`,
`is-collapsed`. Emptiness via `emptyState` with a pane variant (`pane-empty`).

### 2.13 Menu extensions: `checked`, `ui.menuButton`, `doc` - host-only

Seen in (checked): accounts-ui vault-picker.ts:25-50; core-chats view.ts:47. Menu button: core-account-apple main.ts:117,
imap main.ts:125, google main.ts:58, accounts-ui git.ts:161, home-tab.ts:120. Popout document: core-settings
scope-table.ts:91.

```ts
MenuItemSpec = { title; icon?; danger?; disabled?; checked?: boolean; tooltip?: string; onClick } | 'separator'
menu(items, at, o?: { doc?: Document })
menuButton(parent, o: { text: string; items: () => MenuItemSpec[]; variant?: ButtonVariant }): ButtonHandle
```
Classes: existing `menu-item`, `is-danger`; button `hel-button is-menu`.

### 2.14 Notice extensions: action + handle - host-only

Seen in: obsidian-api plugin-separate-notice.ts:5-14 (link inside notice); renderer data-attention.ts:59-60 (click opens
review). `ui.notice` returns void today.

```ts
notice(text, o?: { kind?; timeoutMs?; action?: { text: string; onClick: () => unknown }; onClick?: () => void }): { hide(): void; setText(t: string): void }
```
Classes: `hel-notice is-<kind>`, `hel-notice-action`.

### 2.15 `ui.settings.vaultScope` - host-only

Seen in: accounts-ui access-picker.ts:37-75; core-terminal harness-cards.ts:41-67; connectors secrets-tab.ts:78-100;
core-settings plugin-policy-ui.ts:109-120; core-build default-change.ts:44-49 (checklist of vaults); accounts-ui
vault-picker.ts:23 (menu form).

```ts
settings.vaultScope(parent, o: { name?: string; value: 'all' | 'none' | { only: string[] } | { except: string[] }; vaults: { id: string; name: string; disabled?: string }[];
  kinds?: ('all' | 'none' | 'only' | 'except')[]; homeNote?: boolean; confirmAll?: () => Promise<boolean>; onChange: (v) => void }): { row: Setting; setValue(v): void }
```
Classes: `hel-vault-scope`, `hel-vault-scope-list` (built on `checkList`), `hel-vault-scope-note`.

### 2.16 Standard action additions - host-only (extension to actions.ts:9)

`remove` (danger, confirms with "Remove X?" copy that does not claim irreversibility): accounts-ui home-tab.ts:101,
vault-tab.ts:68; connectors secrets-tab.ts:125, data-tab.ts:87; core-apps view.ts:83; aws/gcp remove modals.
`add`: accounts-ui home-tab.ts:48, vault-tab.ts:24; connectors data-tab.ts:97. `moveUp` / `moveDown`: data-tab.ts:85-86.
`reconnect`: apple :110, imap :118, google :54, accounts-ui home-tab.ts:86, git.ts:157. Also an `icon` placement for
`reset` (core-hotkeys tab.ts:107 uses the icon, not the link).

### 2.17 `ui.composer` (multiline input + send) - frame-safe

Seen in: core-terminal new-session-view.ts:57-61; core-chat-providers chat-view.ts:34-37; core-chats selection.ts:44-47;
core-ask-widgets card.ts:130 (multiline answer).

```ts
composer(parent, o: { placeholder?: string; rows?: number; submitLabel?: string; submitIcon?: string; submitOn?: 'enter' | 'mod-enter'; hint?: string; onSubmit: (text: string) => unknown }): { el; input: HTMLTextAreaElement; setBusy(b: boolean): void; focus(): void; clear(): void }
```
Classes: `hel-composer`, `hel-composer-input`, `hel-composer-send`, `hel-composer-hint`, `is-busy`.

### 2.18 `ui.keyValue` (definition list) - frame-safe

Seen in: apps-runtime dialogs.ts:26-33 (permission sections with lists); renderer connector-review.ts:53-58; obsidian-companion
`.helenite-field` rows; plugin-browser trust lines (trust-modal.ts:22-23).

```ts
keyValue(parent, rows: { key: string; value: string | string[] | Node; empty?: string; isNew?: (item: string) => boolean }[]): HTMLElement
```
Classes: `hel-kv`, `hel-kv-row`, `hel-kv-key`, `hel-kv-value`, `is-empty`, `is-new`.

### 2.19 `ui.chip` - frame-safe

Seen in: core-properties main.ts:331-334; core-ask-widgets card.ts:122 (`helenite-ask-chip`); core-setup ui.ts:55
(`helenite-setup-tag`); core-apps view.ts:62 (`nav-file-tag`); obsidian-companion `.helenite-chip`/`.helenite-pill`.
Could be a `badge` variant; a separate part is justified by `onRemove`/editable.

```ts
chip(parent, text: string, o?: { tone?: Tone; onRemove?: () => void; title?: string }): HTMLElement
```
Classes: `hel-chip`, `hel-chip-remove`, `is-<tone>`.

### 2.20 Empty/error state variants (extension) - frame-safe

Settings lists render empties as left-aligned `setting-item-description` (12 sites listed in section 1); sidebar panes use
Obsidian `pane-empty` (core-chats view.ts:59, core-apps view.ts:48, core-latest-files main.ts:56, core-agent-inbox view.ts:27,
core-properties main.ts:88). `hel-empty` is centred with padding.

```ts
emptyState(parent, text, o?: { variant?: 'block' | 'inline' | 'pane' }): HTMLElement
errorState(parent, text, retry?, o?: { variant?; retryLabel?: string }): HTMLElement
```
Classes: `hel-empty is-inline` (+ `setting-item-description`), `hel-empty is-pane` (+ `pane-empty`).

### Considered and deferred

- Toolbar (`hel-toolbar` exists in ui-kit): renderer diff-view.ts:26, connector-review.ts:94, core-chat-providers chat-view.ts:26.
  Lift with the batch 1 controls; trivial.
- Steps / wizard: core-setup wizard-view.ts:61 and new-vault dialog.ts:34 only (one plugin). Not worth a part yet.
- Progress bar: no recurring use (Obsidian's `ProgressBarComponent` in obsidian-api ui/components/misc.ts:6 is unused by core).
- Avatar: only the vault rail (vault-rail.ts:121). Keep.
- Fuzzy picker: 5 `SuggestModal`s; Obsidian-native, keep.

---

## 3. Recommended order

### Missing parts, in 3 PRs

**Parts PR 1: frame-safe controls lifted from ui-kit.** Move `field`, `textInput`, `searchInput`, `dropdown` (ui-kit
`select`), `toggle`, `tabs`, `toolbar` from packages/ui-kit/src/components into packages/ui/src with the `(parent, options)`
signature, move their CSS from ui-kit.css into 06-design-system.css, make ui-kit re-export them (keeping its old
`o`-only call shapes as thin wrappers so vault apps don't break), add them to `ui` in helenite-module.ts and to the gallery
(plugins/core-settings/src/gallery). Same PR adds the `warning` tone, `statusText`, dot `pulse`, `countBadge`, `chip` and the
empty/error `variant` option. Small, mostly code motion, unblocks most S-sized migrations.

**Parts PR 2: content parts.** `callout`, `card`, `choiceList`, `checkList` (+ `multi` field kind and `detail` on
checkbox), `keyValue`, `composer`, `listRow` / `listGroup`. All frame-safe in packages/ui, so ui-kit gets them free. Each
needs gallery entries and README rows; `choiceList` should become the renderer for `ui.choose` rows to avoid two styles.

**Parts PR 3: host parts.** `ui.dialog`; `confirm`/`form` async `onConfirm`/`onSubmit` and `form.message`; menu `checked`,
`doc` and `menuButton`; notice `action`/`onClick` and a returned handle; `paneHeader`; `settings.card`;
`settings.vaultScope`; new standard actions `remove`, `add`, `moveUp`, `moveDown`, `reconnect` (and a `reset` icon
placement). Watch modals.ts (224 lines) against the 500-line limit (scripts/check-file-size.mjs): put `dialog` in its own
file.

### Plugin migrations, in 5 PRs

**Migration PR A: accounts.** packages/accounts-ui (all files), core-account-apple, -imap, -google, -aws, -gcp,
sample-letterboxd-account. They share the card, status line, menu button, reconnect/remove actions, async danger confirms,
checklists and the vault scope picker, and they render into the same Accounts tab. Delete `ACCOUNTS_CSS` rules made
redundant. Update packages/accounts-ui/test/accounts-ui.test.ts (23 class selectors) and the six account plugin tests.
Size: L.

**Migration PR B: remaining settings tabs.** core-terminal settings side (harness-cards.ts, chat-cards.ts,
home-harnesses-tab.ts, request-harness-modal.ts), packages/connectors/src/ui (Secrets, Data), core-settings leftovers
(plugin-policy-ui div table → `ui.table`, community-home, across-vaults empties, scope-table menu), core-hotkeys (table,
search, reset), obsidian-api override-list.ts. Shared: `vaultScope`, `settings.card`, `ui.table`, empty/error inline
variants, standard actions. This is the PR the Settings screenshot runner can mostly check. Size: L.

**Migration PR C: sidebar panes.** core-chats, core-apps, core-latest-files, core-agent-inbox, core-file-explorer (header,
`confirmDelete` → `ui.confirm`, menus), core-terminal tab dot and find bar. Shared: `paneHeader`, `listRow`/`listGroup`,
`countBadge`, `statusDot` pulse, pane empty variant, `ui.menu`. Size: M.

**Migration PR D: modals and flows.** core-setup (wizard + New vault dialog: `field`, `textInput`, `segmented`, `choiceList`,
`toggle`, `callout`, `dialog`), core-plugin-browser (tabs, search, rows, states, trust confirm), core-importer and core-build
(`form` with `multi`), renderer data-attention / connector-review / diff-view, apps-runtime host dialogs, plugin-permissions
prompt. Shared: `dialog`, `form`/`confirm` extensions, `callout`, `keyValue`. core-setup alone is L because its tests and
e2e (new-vault.test.ts 37 selectors, wizard.test.ts 17, e2e-new-vault.ts 22, e2e-first-run.ts 7) select by class. Size: L
(split core-setup into its own PR if needed).

**Migration PR E: agent surfaces.** core-ask-widgets card, core-chat-providers chat view, core-terminal new-session composer,
core-chats selection popover. Shared: `card` tones, `choiceList` (multi, key hints), `composer`, `chip`, `dropdown` compact.
The ask card is the most styled surface outside settings (sticky pending state, permission tone, pulse); do it last.
Size: L.

Sweep in every PR: replace that unit's `new Notice(` with `ui.notice` (99 call lines; listed per unit above).

---

## 4. Risks

1. **Empty and error text moves.** `ui.emptyState` is centred with padding (06-design-system.css `.hel-empty`); today's
   settings empties are left-aligned `setting-item-description` and pane empties are Obsidian `pane-empty`. Migrating
   without the `variant` option (2.20) visibly re-lays out 17+ places. Check: Settings screenshot runner for settings
   tabs; manual look at each sidebar pane with no data.

2. **Escape and backdrop now mean "no".** `ui.confirm` resolves `false` on any cancel. renderer data-attention.ts:12-31
   records nothing when the prompt is dismissed (only `closedCb`); mapping it to `confirm` would turn Escape into a
   persisted Block. core-importer modals.ts and core-build default-change.ts resolve `null` on dismiss and that already
   matches. Check: data-attention.test.ts; add a test for Escape.

3. **Async failures.** AWS/GCP remove, repair and enforce modals keep the modal open and re-enable the button on error
   (aws main.ts:83-93). Plain `ui.confirm` closes first. Migrate only after 2.2 lands, or users lose their toggle choices
   on a failed remove.

4. **Copy and button order changes.** `ui.action('delete')` always says "This cannot be undone": wrong for file-explorer
   (moves to trash, main.ts:17) and account removal. core-build default-change.ts:62 uses "OK" (copy rules forbid it).
   file-explorer puts Delete before Cancel; `ui.confirm` puts Cancel first and focuses it for danger. Tests that match
   button text or order will fail; that is intended but must be reviewed, not bulk-updated.

5. **Theme compatibility.** Themes target Obsidian classes: `button.mod-cta` / `mod-warning`, `.modal-button-container`,
   `.setting-item`, `.nav-file-title`, `.pane-empty`, `.checkbox-container`, `.dropdown`, `.search-input-container`.
   `hel-button` keeps `mod-cta`/`mod-warning`/`clickable-icon` (06-design-system.css:19-22), but `hel-modal-actions`
   replaces `modal-button-container`, and new parts must emit the Obsidian class too (see 2.4, 2.10, 2.12) or third-party
   themes stop styling them. Check: `node compat/src/drive.mjs themes` (theme-run screenshots the fixture vault's
   Showcase.md under each theme) and the settings run under 2-3 popular themes.

6. **Screenshot coverage is narrow.** compat/src/runner/settings-run.ts covers only Settings tabs, by default
   `general, appearance, core-plugins, community-plugins, across-vaults, terminal` (settings-run.ts:33) plus listed
   sub-pages and the gallery. Accounts, Secrets, Data and Hotkeys are not in the default list: pass
   `--tabs=accounts,secrets,data,hotkeys` (drive.mjs settings `--tabs`) and record baselines before PR A/B. Nothing
   screenshots sidebar panes, modals, the setup wizard, the New vault dialog, ask cards or app host dialogs; for those
   rely on unit tests plus e2e scripts (apps/desktop/src/main/e2e-*.ts) and a manual pass with `--user-data` scratch.

7. **Tests and e2e select by one-off classes.** 31 test/e2e files reference `helenite-*` classes (largest:
   core-setup/test/new-vault.test.ts 37, accounts-ui.test.ts 23, core-ask-widgets/test/ask-widgets.test.ts 19,
   core-setup/test/wizard.test.ts 17, core-settings/test/scope-table.test.ts 16, core-terminal/test/home-tab.test.ts 16,
   e2e-new-vault.ts 22, e2e-vault-connectors.ts 13). Prefer `data-*` hooks (several already exist: `data-account`,
   `data-harness`, `data-action`) over swapping one class name for another.

8. **Popouts and the Settings OS window.** `ui.menu` has no document option; core-settings scope-table.ts:91 passes
   `note.ownerDocument`. Settings can open as its own OS window (packages/obsidian-api/src/ui/settings-os-window.ts), and
   plugin-permissions prompt-dom.ts takes a `getDoc` for popouts. Migrating these to parts that assume the main
   `document` would draw menus/modals in the wrong window. Add `doc` (2.13) first.

9. **Host-drawn dialogs must stay unfakeable.** apps-runtime dialogs.ts deliberately draws outside any app frame, and the
   secret dialog must never be reachable by app code. A shared `ui.dialog` is fine (host-only), but do not route these
   through the ui-kit bridge overlays.

10. **obsidian-companion and Obsidian-native DOM.** The companion runs in real Obsidian with no `helenite` module; leave it.
    core-properties' metadata editor, core-hotkeys' `.setting-hotkey` chips, the file tree and the vault rail mimic
    Obsidian DOM on purpose so themes and snippets apply; replacing them with `hel-*` parts would break theme
    parity.

11. **Two copies during the lift.** Until ui-kit re-exports the lifted controls, `hel-field`/`hel-tabs`/`hel-input` rules
    would exist in both ui-kit.css and 06-design-system.css with different specificity. Move the CSS in the same PR and
    check an app frame (theme `inherit` and `isolate`) in the apps fixture vault.
