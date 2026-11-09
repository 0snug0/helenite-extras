# @helenite/ui-kit

Plain-DOM components for sandboxed Helenite apps. No framework, no `innerHTML`, no network or storage; styled only by theme variables (`src/ui-kit.css`, import it from the app's `view.css`).

```js
import { setBridge, sortableTable, cardGrid, posterRow, picker, tabs, calendarStrip, emptyState, errorState, confirm, choose, menu, notice } from "@helenite/ui-kit";
setBridge(api);                          // the app's capability api: modals/menus/notices are drawn by the HOST
const ok = await confirm("Remove?", "This cannot be undone.", { danger: true });
```

Components return a `{ el, ...handle }` (or an element for controls). Host-rendered UI goes through `api.ui.modal/menu/notice/overlay` and `api.secrets.prompt`: see `src/bridge.ts` for the declarative specs the host must implement.
