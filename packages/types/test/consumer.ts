// Compiled against dist/helenite.d.ts and the DOM libs only (tsconfig.json): what a plugin author sees.
import { ui, version } from 'helenite';
import type { ButtonOptions, Field, MenuItemSpec, ActionId } from 'helenite';
import type { DropdownHandle, FieldHandle, Tone, ToggleHandle } from 'helenite';

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

// The public types are exported type-only.
const opts: ButtonOptions = { text: 'Save', variant: 'primary' };
ui.button(document.body, opts);
const fields: Field[] = [{ id: 'name', kind: 'text', label: 'Name' }];
void ui.form({}, { title: 'Rename note', fields, action: 'Rename' });
const items: MenuItemSpec[] = [{ title: 'Rename', onClick: () => undefined }, 'separator'];
ui.menu(items, { x: 0, y: 0 });
const id: ActionId = 'delete';
ui.action(document.body, id, { onClick: () => undefined, app: {}, subject: 'note' });

// The frame-safe controls and small parts, with their typed handles.
const f: FieldHandle = ui.field(document.body, { label: 'Name', hint: 'Shown in the sidebar.' });
ui.textInput(f.control, { placeholder: 'Untitled', onEnter: (s: string) => f.setError(s ? null : 'Enter a name.') });
const t: ToggleHandle = ui.toggle(document.body, { value: true, label: 'Sync' });
t.setDisabled(false);
const d: DropdownHandle<'list' | 'grid'> = ui.dropdown(document.body, { options: [{ value: 'list', text: 'List' }, { value: 'grid', text: 'Grid' }], value: 'grid' });
d.setValue('list');
// @ts-expect-error: not one of the dropdown's values.
d.setValue('board');
const tone: Tone = 'warning';
ui.statusText(document.body, 'Partly works', tone);
ui.countBadge(document.body, 3, { pulse: true }).set(0);
ui.tabs(document.body, { tabs: [{ id: 'a', text: 'A' }], value: 'a', onSelect: (id: 'a') => id }).setBadge('a', 2);
ui.emptyState(document.body, 'No accounts yet.', { variant: 'inline' });
