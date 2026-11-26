// What more than one page draws for an item: its table, its menu and its details dialog.
import { ui, type MenuItemSpec } from 'helenite';
import { STATUSES, statusOf, type Item } from './data';
import type SampleDesignSystemPlugin from './main';

/** `onRemoved` runs after a delete, for a table that nothing else redraws. */
export function itemTable(el: HTMLElement, plugin: SampleDesignSystemPlugin, rows: Item[], onRemoved?: () => void) {
  return ui.table<Item>(el, {
    columns: [
      { key: 'name', title: 'Name', cell: (r) => r.name },
      { key: 'kind', title: 'Kind', fit: true, cell: (r, td) => void ui.badge(td, r.kind) },
      { key: 'status', title: 'Status', fit: true, cell: (r, td) => void ui.statusText(td, statusOf(r).text, statusOf(r).tone) },
    ],
    rows,
    empty: 'No items yet.',
    // `delete` asks before it runs, naming the item.
    actions: (r, cell) => void ui.action(cell, 'delete', {
      app: plugin.app, subject: r.name,
      onClick: async () => {
        await plugin.remove(r);
        onRemoved?.();
      },
    }),
  });
}

export function itemMenu(plugin: SampleDesignSystemPlugin, item: Item): MenuItemSpec[] {
  return [
    { title: 'Open', icon: 'panel-right-open', onClick: () => void openItem(plugin, item) },
    { title: 'Rename', icon: 'pencil', onClick: () => void plugin.rename(item) },
    'separator',
    ...STATUSES.map((s) => ({ title: s.text, checked: item.status === s.id, onClick: () => void plugin.move(item.id, s.id) })),
    'separator',
    {
      title: 'Delete', icon: 'trash-2', danger: true,
      onClick: () => void ui.confirm(plugin.app, {
        title: `Delete ${item.name}`, message: `Delete ${item.name}? This cannot be undone.`, action: 'Delete', danger: true,
        onConfirm: () => plugin.remove(item),
      }),
    },
  ];
}

/** A dialog with the content on the left and its properties on the right. */
export function openItem(plugin: SampleDesignSystemPlugin, item: Item): Promise<unknown> {
  let name = item.name;
  return ui.dialog(plugin.app, {
    title: 'Edit item',
    width: 'wide',
    render: (body, ctx) => {
      const { main, side } = ctx.sidePanel();
      ui.textInput(ui.field(main, { label: 'Name', fill: true }).control, { value: name, onInput: (v) => (name = v) });
      ui.keyValue(side, [
        { key: 'Kind', value: item.kind },
        { key: 'Status', value: statusOf(item).text },
        { key: 'Pinned', value: item.pinned ? 'Yes' : 'No' },
      ]);
    },
    actions: [{
      text: 'Save', variant: 'primary', onClick: async (ctx) => {
        if (!name.trim()) throw new Error('Enter a name.');
        item.name = name.trim();
        await plugin.save();
        ctx.close(null);
      },
    }],
  });
}
