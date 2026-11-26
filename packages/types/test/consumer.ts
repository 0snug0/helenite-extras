// Compiled against helenite.d.ts and the DOM libs only (tsconfig.json): what a plugin author sees.
import { ui, version } from 'helenite';
import type { ButtonOptions, Field, MenuItemSpec, ActionId } from 'helenite';
import type { DropdownHandle, FieldHandle, Tone, ToggleHandle } from 'helenite';
import type { CardHandle, DisclosureHandle, CheckListHandle, FieldValues, MeterOptions, BarChartOptions, Thread, ThreadEntry, BoardCardHandle, AvatarOptions, SwatchOptions, PopoverHandle } from 'helenite';

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
const pop: PopoverHandle = ui.popover({ left: 0, right: 0, top: 0, bottom: 0 }, { title: 'Ask', quote: 'text', width: 380, onClose: (reason) => reason === 'outside' });
ui.popover(rowEl, { side: 'top', returnFocus: rowEl }).close();
ui.popover(null).footer.append(pop.body);
// @ts-expect-error: a popover needs an anchor (null centers it).
ui.popover();
ui.composer(rowEl, { submitOn: 'mod-enter', onSubmit: async (text: string) => text }).setBusy(false);
ui.keyValue(document.body, [{ key: 'Hosts', value: ['a.com'], isNew: () => true }]);
const talk: Thread = ui.thread(document.body, { maxIndent: 2 });
const said: ThreadEntry = talk.entry();
const under: HTMLElement = said.replies().event('Started');
ui.threadText(under, 'a\nb');
const reading: MeterOptions = { label: 'Context', value: 20, text: '40k / 200k', tone: 'success' };
const gauge: HTMLElement = ui.meter(rowEl, reading);
// @ts-expect-error: a meter needs its reading in words.
ui.meter(gauge, { label: 'Context', value: 20 });
ui.meter(gauge, { layout: 'bar', label: 'llama3', value: 20 });
ui.meter(gauge, { layout: 'stacked', label: 'Weekly', text: '30%', sub: 'resets in 3d' });
const lane = ui.board(rowEl, { label: 'Tickets', onDrop: (id: string, to: string, index: number) => console.log(id, to, index) }).lane({ id: 'todo', label: 'To do' });
const boardCard: BoardCardHandle = lane.card({ id: 'T-1', title: 'Fix it', tone: 'accent', onOpen: () => undefined });
ui.badge(boardCard.meta, 'P1');
const doneCard = lane.card({ id: 'T-2', check: { checked: false, label: 'Done', onToggle: (checked: boolean) => console.log(checked) } });
doneCard.content.textContent = 'text';
ui.moreButton(doneCard.actions, () => []);
const titled = ui.board(rowEl).lane({ id: 'x', label: 'X', title: 'X', onTitleClick: () => undefined });
ui.button(titled.footer, { text: 'Add a card' });
const who: AvatarOptions = { text: 'Ada Lovelace', size: 'small' };
const face: HTMLElement = ui.avatar(boardCard.meta, who);
// @ts-expect-error: an avatar needs its text.
ui.avatar(face, { size: 'large' });
const shade: SwatchOptions = { kind: 'color', value: 'var(--color-red)', label: '--color-red' };
const chipOfColor: HTMLElement = ui.swatch(face, shade);
// @ts-expect-error: not a kind of value.
ui.swatch(chipOfColor, { kind: 'spacing', value: '4px', label: '--size-4-1' });
const step: DisclosureHandle = ui.disclosure(document.body, { title: 'Sync', summary: 'iCloud', onToggle: (open) => step.setOpen(open) });
step.setSummary('Dropbox');
// @ts-expect-error: a disclosure needs a title.
ui.disclosure(document.body, {});
// @ts-expect-error: a board card needs an id.
lane.card({ title: 'No id' });
const costs: BarChartOptions = { label: 'Cost per day', buckets: [{ key: 'Nov 25', value: 2, title: '$2.00' }] };
const chart: HTMLElement = ui.barChart(rowEl, costs);
// @ts-expect-error: a bucket needs its value.
ui.barChart(chart, { label: 'Cost per day', buckets: [{ key: 'Nov 25' }] });
const multi: Field = { id: 'caps', kind: 'multi', label: 'Capabilities', options: [{ value: 'read', label: 'Read' }] };
const box: Field = { id: 'sync', kind: 'checkbox', label: 'Sync', detail: 'Every hour' };
void ui.form({}, { title: 'Connect Git', fields: [multi, box], action: 'Connect' }).then((v: FieldValues | null) => v?.caps);

// The host parts.
import type { DialogContext, NoticeHandle, SettingsCardHandle, VaultScope } from 'helenite';
void ui.dialog<string>({}, {
  title: 'Import notes', width: 'wide', cancel: false, doc: document,
  render: (body: HTMLElement, ctx: DialogContext<string>) => { body.append('x'); ctx.setError(null); return () => undefined; },
  actions: [{ text: 'Import', variant: 'primary', onClick: async (ctx) => ctx.close('done') }],
}).then((r: string | null) => r);
void ui.confirm({}, { title: 'Remove account', message: 'Remove it?', action: 'Remove', onConfirm: async () => undefined });
void ui.form({}, { title: 'Repair access', message: 'm', fields: [], action: 'Repair', onSubmit: async (v: FieldValues) => v });
ui.menu([{ title: 'All vaults', checked: true, tooltip: 't', onClick: () => undefined }], { x: 0, y: 0 }, { doc: document });
ui.menuButton(document.body, { text: 'Add permission…', items: () => [], variant: 'primary' }).setDisabled(true);
const n: NoticeHandle = ui.notice('Saved', { action: { text: 'Undo', onClick: () => undefined }, onClick: () => undefined });
n.setText('Saved again');
n.hide();
ui.paneHeader(document.body, [{ icon: 'plus', label: 'New', onClick: (e: MouseEvent) => e }]);
const sc: SettingsCardHandle = ui.settings.card(document.body, { name: 'Claude Code', icon: 'terminal', status: { text: 'Ready', tone: 'warning' } });
sc.head.setDesc('claude');
sc.setStatus(null);
const scope: VaultScope = { except: ['a'] };
ui.settings.vaultScope(sc.body, { value: scope, vaults: [{ id: 'a', name: 'A', disabled: 'Off', on: true }], kinds: ['all', 'all-off', 'only'], homeNote: true, onChange: (v: VaultScope) => v }).setValue('none');
const inlineScope = ui.settings.vaultScope(sc.head.controlEl, { value: 'all-off', vaults: [], inline: true, disabled: true, onChange: () => undefined });
inlineScope.setDisabled(false);
// @ts-expect-error: row is null when inline.
inlineScope.row.setName('x');
ui.action(document.body, 'remove', { onClick: () => undefined, app: {}, subject: 'Gmail', confirmText: 'Remove', message: 'Remove Gmail?' });
ui.action(document.body, 'reset', { onClick: () => undefined, variant: 'icon' });
// @ts-expect-error: not a vault scope.
ui.settings.vaultScope(document.body, { value: 'some', vaults: [], onChange: () => undefined });
