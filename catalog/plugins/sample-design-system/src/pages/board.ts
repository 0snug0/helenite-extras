// The items as a board: drag a card between lanes, or use its menu (dragging has no keyboard equivalent).
import { ui } from 'helenite';
import { STATUSES } from '../data';
import { itemMenu, openItem } from '../item-parts';
import type SampleDesignSystemPlugin from '../main';

/** `hold` stops redraws while a card is dragged: a redraw would take the card away. */
export function drawBoard(el: HTMLElement, plugin: SampleDesignSystemPlugin, hold: (dragging: boolean) => void): void {
  const board = ui.board(el, {
    label: 'Items',
    onDragStart: () => hold(true),
    onDragEnd: () => hold(false),
    onDrop: (id, lane, index) => {
      const status = STATUSES.find((s) => s.id === lane);
      if (status) void plugin.move(id, status.id, index);
    },
  });
  for (const status of STATUSES) {
    const items = plugin.data.items.filter((i) => i.status === status.id);
    const lane = board.lane({ id: status.id, label: status.text, title: status.text, onTitleClick: () => ui.notice(`${items.length} in ${status.text}`) });
    ui.badge(lane.head, String(items.length), status.tone);
    if (!items.length) ui.emptyState(lane.list, 'No items', { variant: 'inline' });
    for (const item of items) {
      const card = lane.card({
        id: item.id,
        label: item.name,
        onOpen: () => void openItem(plugin, item),
        check: { checked: status.id === 'done', label: `Done: ${item.name}`, onToggle: (done) => void plugin.move(item.id, done ? 'done' : 'todo', 0) },
      });
      card.content.setText(item.name);
      ui.moreButton(card.actions, () => itemMenu(plugin, item));
      ui.badge(card.meta, item.kind);
      if (item.pinned) ui.chip(card.meta, 'Pinned', { tone: 'accent' });
    }
    if (status.id === 'todo') ui.button(lane.footer, { text: 'Add item', icon: 'plus', variant: 'link', onClick: () => void plugin.addItem() });
  }
}
