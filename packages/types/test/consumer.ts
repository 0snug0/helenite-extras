// Compiled against dist/helenite.d.ts and the DOM libs only (tsconfig.json): what a plugin author sees.
import { ui, version } from 'helenite';

ui.button(document.body, { text: 'x' });
const v: string = version;

// The settings parts sit under ui.settings; `row` is the Setting class.
const row = new ui.settings.row(document.body).setName('Name').setDesc(v);
ui.settings.summaryRow(document.body, { name: 'Accounts', desc: '2 signed in' }).setDesc(row.nameEl.textContent ?? '');
ui.menu([{ title: 'Open', onClick: () => undefined }, 'separator'], { x: 0, y: 0 });
ui.action(document.body, 'reset', { onClick: () => undefined });
void ui.confirm({}, { title: 'Delete note', message: 'Delete it?', action: 'Delete', danger: true }).then((ok: boolean) => ok);

// @ts-expect-error: not a standard action id.
ui.action(document.body, 'explode', { onClick: () => undefined });
