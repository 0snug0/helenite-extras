// Compiled against dist/helenite.d.ts and the DOM libs only (tsconfig.json): what a plugin author sees.
import { ui, version } from 'helenite';
import type { ButtonOptions, Field, MenuItemSpec, ActionId } from 'helenite';
import type { DropdownHandle, FieldHandle, Tone, ToggleHandle } from 'helenite';
import type { CardHandle, CheckListHandle, FieldValues } from 'helenite';

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

// The content parts.
ui.callout(document.body, { tone: 'accent', text: 'Waiting', action: { text: 'Answer now' }, live: true }).setTone('danger');
const c: CardHandle = ui.card(document.body, { title: 'Claude Code', icon: 'terminal', tone: 'muted', compact: true });
c.setTone('accent');
const caps: CheckListHandle<'mail' | 'cal'> = ui.checkList(document.body, { options: [{ value: 'mail', text: 'Mail', detail: 'd' }, { value: 'cal', text: 'Calendar' }], value: ['mail'] });
// @ts-expect-error: not one of the check list's values.
caps.setValue(['files']);
ui.choiceList(document.body, { options: [{ value: 'a', text: 'A', key: '1' }], value: 'a', onChange: (v: string) => v });
ui.choiceList(document.body, { multi: true, options: [{ value: 'a', text: 'A' }], value: ['a'], onChange: (v: string[]) => v });
const g = ui.listGroup(document.body, { title: 'Today', count: 2 });
const rowEl: HTMLElement = ui.listRow(g.body, { title: 'Row', obsidianClass: 'tree-item', menu: () => [{ title: 'Open', onClick: () => undefined }] });
ui.composer(rowEl, { submitOn: 'mod-enter', onSubmit: async (text: string) => text }).setBusy(false);
ui.keyValue(document.body, [{ key: 'Hosts', value: ['a.com'], isNew: () => true }]);
const multi: Field = { id: 'caps', kind: 'multi', label: 'Capabilities', options: [{ value: 'read', label: 'Read' }] };
const box: Field = { id: 'sync', kind: 'checkbox', label: 'Sync', detail: 'Every hour' };
void ui.form({}, { title: 'Connect Git', fields: [multi, box], action: 'Connect' }).then((v: FieldValues | null) => v?.caps);
