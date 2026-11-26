// A toolbar over the items, shown as grouped list rows or as a table.
import { ui } from 'helenite';
import { STATUSES, statusOf, type Item } from '../data';
import { itemMenu, itemTable, openItem } from '../item-parts';
import type SampleDesignSystemPlugin from '../main';

export interface ItemFilter {
  query: string;
  kind: string;
  layout: string;
}

export function drawItems(el: HTMLElement, plugin: SampleDesignSystemPlugin, filter: ItemFilter): void {
  const bar = ui.toolbar(el, { label: 'Item filters' });
  ui.searchInput(bar, {
    placeholder: 'Search items', value: filter.query,
    onSearch: (q) => {
      filter.query = q;
      draw();
    },
  });
  ui.dropdown(bar, {
    label: 'Kind', compact: true, value: filter.kind,
    options: [{ value: 'all', text: 'All kinds' }, { value: 'note', text: 'Notes' }, { value: 'link', text: 'Links' }],
    onChange: (kind) => {
      filter.kind = kind;
      draw();
    },
  });
  ui.segmented(bar, {
    label: 'View:', value: filter.layout,
    options: [{ value: 'list', text: 'List' }, { value: 'table', text: 'Table' }],
    onChange: (layout) => {
      filter.layout = layout;
      draw();
    },
  });
  // `hel-toolbar-end` pushes a button to the far end of a toolbar.
  ui.button(bar, { text: 'Add item', variant: 'primary', onClick: () => void plugin.addItem() }).el.classList.add('hel-toolbar-end');

  const list = el.createDiv();
  const draw = (): void => {
    list.empty();
    const q = filter.query.toLowerCase();
    const items = plugin.data.items.filter((i) => i.name.toLowerCase().includes(q) && (filter.kind === 'all' || i.kind === filter.kind));
    if (!items.length) {
      ui.emptyState(list, plugin.data.items.length ? 'No items match.' : 'No items yet.');
      return;
    }
    if (filter.layout === 'table') itemTable(list, plugin, items);
    else drawGroups(list, plugin, items);
  };
  draw();
}

function drawGroups(el: HTMLElement, plugin: SampleDesignSystemPlugin, items: Item[]): void {
  const detailed = plugin.data.density === 'detailed';
  for (const status of STATUSES) {
    const rows = items.filter((i) => i.status === status.id);
    if (!rows.length) continue;
    const group = ui.listGroup(el, { title: status.text, count: rows.length });
    for (const item of rows) {
      ui.listRow(group.body, {
        title: item.name,
        dot: { tone: statusOf(item).tone, label: statusOf(item).text },
        tag: item.pinned ? 'Pinned' : undefined,
        meta: item.kind,
        // The detailed density adds a second line and a line of chips.
        sub: detailed ? `${statusOf(item).text} · added from the sample` : undefined,
        chips: detailed && item.pinned ? [{ text: 'pinned', tone: 'accent' }, item.kind] : undefined,
        actions: [{ icon: 'pencil', label: 'Rename', id: 'rename', onClick: () => void plugin.rename(item) }],
        onClick: () => void openItem(plugin, item),
        menu: () => itemMenu(plugin, item),
      });
    }
  }
}
