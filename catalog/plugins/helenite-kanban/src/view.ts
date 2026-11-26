// The board view: a TextFileView over a board note. Edits go through ops.ts and are written straight back to the note.
import { MarkdownRenderer, TextFileView, type WorkspaceLeaf } from 'obsidian';
import { ui, type BoardHandle, type MenuItemSpec } from 'helenite';
import { parseBoard, serializeBoard, type Board, type Card, type Lane } from './board';
import * as ops from './ops';

export const VIEW_TYPE = 'helenite-kanban';

/** In a prompt, a card's line breaks are shown as <br> (the board format reads <br> back as a line break). */
const toPrompt = (text: string): string => text.replace(/\r?\n/g, '<br>');
const fromPrompt = (text: string): string => text.replace(/<br>/g, '\n');
const firstLine = (text: string): string => text.split('\n')[0] || '(empty card)';
const required = (what: string) => (v: string) => (v.trim() ? null : `Enter a ${what}.`);

/** A card of one paragraph is shown without the paragraph's margins, so it is no taller than its text. */
function unwrapParagraph(el: HTMLElement): void {
  const only = el.children.length === 1 ? el.firstElementChild! : null;
  if (only?.tagName === 'P') only.replaceWith(...Array.from(only.childNodes));
}

interface Scroll {
  x: number;
  lists: { lane: string | undefined; top: number }[];
}

export interface KanbanHost {
  /** Reopen the leaf as a plain markdown note. */
  openAsMarkdown(leaf: WorkspaceLeaf): void;
}

export class KanbanView extends TextFileView {
  board: Board = parseBoard('');
  /** Only an edit made here rewrites the note; just viewing a hand-written board leaves its layout alone. */
  private dirty = false;
  /** While a card is dragged the board is not redrawn; a redraw asked for meanwhile runs when the drag ends. */
  private dragging = false;
  private pending = false;

  constructor(leaf: WorkspaceLeaf, private host: KanbanHost) {
    super(leaf);
  }

  getViewType(): string {
    return VIEW_TYPE;
  }

  getIcon(): string {
    return 'square-kanban';
  }

  async onOpen(): Promise<void> {
    this.addAction('file-text', 'Open as markdown', () => this.host.openAsMarkdown(this.leaf));
  }

  getViewData(): string {
    if (!this.dirty) return this.data;
    const useTab = (this.app.vault as any).getConfig?.('useTab') !== false;
    return serializeBoard(this.board, { useTab });
  }

  setViewData(data: string, clear: boolean): void {
    // Another note: its board starts at the top, not where the last one was scrolled to. A card dragged from the last one
    // is gone with it, so its dragend may never come.
    if (clear) {
      this.contentEl.empty();
      this.dragging = this.pending = false;
    }
    this.data = data;
    this.dirty = false;
    this.board = parseBoard(data);
    this.render();
  }

  clear(): void {
    this.board = parseBoard('');
    this.dirty = false;
  }

  /** Writes only after an edit here, never for a board that is still loading or was only viewed. */
  async save(clear?: boolean): Promise<void> {
    if (this.dirty) await super.save(clear);
  }

  /** Apply an edit, redraw and save. */
  update(next: Board): void {
    this.board = next;
    this.dirty = true;
    this.render();
    void this.save();
  }

  render(): void {
    if (this.dragging) {
      this.pending = true;
      return;
    }
    const root = this.contentEl;
    const scroll = this.scrollPositions();
    root.empty();
    root.addClass('hel-board-page');
    const bar = ui.toolbar(root, { label: 'Board' });
    ui.button(bar, { text: 'Add list', icon: 'plus', onClick: () => this.addLane() });
    if (this.board.archive.length) {
      ui.button(bar, { text: `Archived cards (${this.board.archive.length})`, icon: 'archive', onClick: () => this.restoreFromArchive() });
    }
    if (!this.board.lanes.length) {
      ui.emptyState(root, 'No lists yet. Add a list to start the board.');
      return;
    }
    const shown = this.board;
    const board = ui.board(root, {
      label: 'Lists',
      onDragStart: () => { this.dragging = true; },
      onDragEnd: () => this.endDrag(),
      // The note was read again mid-drag: these ids belong to the board that was replaced, so nothing is written.
      onDrop: (id, lane, at) => { if (this.board === shown) this.update(ops.moveCard(shown, id, lane, at)); },
    });
    const drawn = this.board.lanes.flatMap((lane, i) => this.renderLane(board, lane, i));
    this.restoreScroll(scroll);
    // Again once the cards have their text: until then a list may be too short to scroll that far.
    void Promise.allSettled(drawn).then(() => {
      if (board.el.parentElement === root) this.restoreScroll(scroll);
    });
  }

  /** Returns when each card's markdown is drawn. */
  private renderLane(board: BoardHandle, lane: Lane, index: number): Promise<void>[] {
    const title = lane.title || 'Untitled list';
    const { head, list, card } = board.lane({ id: lane.id, label: title });
    ui.statusText(head, title).addEventListener('dblclick', () => void this.renameLane(lane));
    const count = lane.maxItems ? `${lane.cards.length}/${lane.maxItems}` : String(lane.cards.length);
    ui.badge(head, count, lane.maxItems && lane.cards.length > lane.maxItems ? 'danger' : lane.markComplete ? 'success' : 'default');
    ui.moreButton(head, () => this.laneMenu(lane, index), 'List options').el.classList.add('hel-toolbar-end');

    if (!lane.cards.length) ui.emptyState(list, 'No cards', { variant: 'inline' });
    const drawn = lane.cards.map((c) => this.renderCard(card({ id: c.id, tone: c.checked ? 'muted' : 'default' }).head, c, lane));
    ui.button(list, { text: 'Add a card', icon: 'plus', variant: 'link', onClick: () => this.addCard(lane) });
    return drawn;
  }

  /** The done checkbox, the card's markdown and its menu, side by side in the card's head (a part for this: HELENITE-185). */
  private renderCard(row: HTMLElement, card: Card, lane: Lane): Promise<void> {
    // In a box of its own, or long text beside it squeezes the checkbox.
    const check = row.createDiv().createEl('input', { cls: 'task-list-item-checkbox', type: 'checkbox' });
    check.checked = card.checked;
    check.setAttribute('aria-label', card.checked ? 'Mark card as not done' : 'Mark card as done');
    check.addEventListener('click', (e) => {
      e.stopPropagation();
      this.update(ops.toggleCard(this.board, card.id));
    });
    const body = row.createDiv({ cls: 'markdown-rendered' });
    const drawn = MarkdownRenderer.render(this.app, card.text, body, this.file?.path ?? '', this).then(() => unwrapParagraph(body));
    body.addEventListener('dblclick', () => void this.editCard(card));
    ui.moreButton(row, () => this.cardMenu(card, lane), 'Card options');
    return drawn;
  }

  private endDrag(): void {
    this.dragging = false;
    if (this.pending) {
      this.pending = false;
      this.render();
    }
  }

  /** How far the row of lists and each list are scrolled, so an edit's redraw leaves the board where it was. */
  private scrollPositions(): Scroll {
    return {
      x: this.contentEl.querySelector<HTMLElement>('.hel-board')?.scrollLeft ?? 0,
      lists: Array.from(this.contentEl.querySelectorAll<HTMLElement>('.hel-board-lane'), (l) => ({
        lane: l.dataset.lane,
        top: l.querySelector<HTMLElement>('.hel-board-list')?.scrollTop ?? 0,
      })),
    };
  }

  private restoreScroll(p: Scroll): void {
    const row = this.contentEl.querySelector<HTMLElement>('.hel-board');
    if (row) row.scrollLeft = p.x;
    const lanes = Array.from(this.contentEl.querySelectorAll<HTMLElement>('.hel-board-lane'));
    // A list keeps its place when lists move or go. After the note is read again the ids are new: then go by position.
    const kept = lanes.some((l) => p.lists.some((s) => s.lane === l.dataset.lane));
    lanes.forEach((l, i) => {
      const saved = kept ? p.lists.find((s) => s.lane === l.dataset.lane) : p.lists[i];
      const list = l.querySelector<HTMLElement>('.hel-board-list');
      if (list && saved?.top) list.scrollTop = saved.top;
    });
  }

  private laneMenu(lane: Lane, index: number): MenuItemSpec[] {
    const last = this.board.lanes.length - 1;
    return [
      { title: 'Rename list', icon: 'pencil', onClick: () => this.renameLane(lane) },
      { title: 'Add a card at the top', icon: 'plus', onClick: () => this.addCard(lane, 0) },
      { title: 'Set card limit', icon: 'hash', onClick: () => this.setLimit(lane) },
      {
        title: lane.markComplete ? 'Stop marking cards as done' : 'Mark cards in this list as done',
        icon: 'check-square',
        onClick: () => this.update(ops.setMarkComplete(this.board, lane.id, !lane.markComplete)),
      },
      { title: 'Archive done cards', icon: 'archive', disabled: !lane.cards.some((c) => c.checked), onClick: () => this.update(ops.archiveDone(this.board, lane.id)) },
      'separator',
      { title: 'Move list left', icon: 'arrow-left', disabled: index === 0, onClick: () => this.update(ops.moveLane(this.board, lane.id, index - 1)) },
      { title: 'Move list right', icon: 'arrow-right', disabled: index === last, onClick: () => this.update(ops.moveLane(this.board, lane.id, index + 1)) },
      'separator',
      { title: 'Delete list', icon: 'trash-2', danger: true, onClick: () => this.deleteLane(lane) },
    ];
  }

  private cardMenu(card: Card, lane: Lane): MenuItemSpec[] {
    const at = lane.cards.findIndex((c) => c.id === card.id);
    return [
      { title: 'Edit card', icon: 'pencil', onClick: () => this.editCard(card) },
      { title: 'Move card to list', icon: 'arrow-right-left', disabled: this.board.lanes.length < 2, onClick: () => this.moveToLane(card, lane) },
      { title: 'Move to top', icon: 'arrow-up-to-line', disabled: at === 0, onClick: () => this.update(ops.moveCard(this.board, card.id, lane.id, 0)) },
      { title: 'Move to bottom', icon: 'arrow-down-to-line', disabled: at === lane.cards.length - 1, onClick: () => this.update(ops.moveCard(this.board, card.id, lane.id, lane.cards.length)) },
      'separator',
      { title: 'Archive card', icon: 'archive', onClick: () => this.update(ops.archiveCard(this.board, card.id)) },
      { title: 'Delete card', icon: 'trash-2', danger: true, onClick: () => this.deleteCard(card) },
    ];
  }

  private async addLane(): Promise<void> {
    const title = await ui.prompt(this.app, { title: 'Add list', label: 'Name', placeholder: 'To do', action: 'Add list', validate: required('name') });
    if (title) this.update(ops.addLane(this.board, title));
  }

  private async renameLane(lane: Lane): Promise<void> {
    const title = await ui.prompt(this.app, { title: 'Rename list', label: 'Name', value: lane.title, action: 'Rename', validate: required('name') });
    if (title && title.trim() !== lane.title) this.update(ops.renameLane(this.board, lane.id, title));
  }

  private async setLimit(lane: Lane): Promise<void> {
    const v = await ui.prompt(this.app, {
      title: 'Set card limit',
      label: 'Most cards in this list (0 for no limit)',
      value: String(lane.maxItems),
      action: 'Set limit',
      validate: (s) => (/^\d+$/.test(s.trim()) ? null : 'Enter a whole number.'),
    });
    if (v !== null) this.update(ops.setMaxItems(this.board, lane.id, Number(v.trim())));
  }

  private async deleteLane(lane: Lane): Promise<void> {
    const n = lane.cards.length;
    const ok = await ui.confirm(this.app, {
      title: 'Delete list',
      message: `Delete ${lane.title || 'this list'}${n ? ` and its ${n} card${n === 1 ? '' : 's'}` : ''}? This cannot be undone.`,
      action: 'Delete',
      danger: true,
    });
    if (ok) this.update(ops.deleteLane(this.board, lane.id));
  }

  private async addCard(lane: Lane, at?: number): Promise<void> {
    const text = await ui.prompt(this.app, { title: 'Add card', label: 'Card', placeholder: 'What needs doing?', action: 'Add card', validate: required('card') });
    if (text) this.update(ops.addCard(this.board, lane.id, fromPrompt(text), at));
  }

  private async editCard(card: Card): Promise<void> {
    const text = await ui.prompt(this.app, { title: 'Edit card', label: 'Card (<br> starts a new line)', value: toPrompt(card.text), action: 'Save', validate: required('card') });
    if (text !== null && fromPrompt(text).trim() !== card.text) this.update(ops.editCard(this.board, card.id, fromPrompt(text)));
  }

  private async deleteCard(card: Card): Promise<void> {
    const ok = await ui.confirm(this.app, { title: 'Delete card', message: `Delete "${firstLine(card.text)}"? This cannot be undone.`, action: 'Delete', danger: true });
    if (ok) this.update(ops.deleteCard(this.board, card.id));
  }

  private async moveToLane(card: Card, from: Lane): Promise<void> {
    const options = this.board.lanes.map((l) => ({ value: l.id, text: l.title || 'Untitled list', disabled: l.id === from.id }));
    const to = await ui.choose(this.app, { title: 'Move card to list', options });
    if (to) this.update(ops.moveCard(this.board, card.id, to, Number.MAX_SAFE_INTEGER));
  }

  private async restoreFromArchive(): Promise<void> {
    const first = this.board.lanes[0];
    if (!first) {
      ui.notice('Add a list first, then restore cards into it.');
      return;
    }
    const id = await ui.choose(this.app, {
      title: `Restore a card to ${first.title || 'the first list'}`,
      options: this.board.archive.map((c) => ({ value: c.id, text: firstLine(c.text) })),
    });
    if (!id) return;
    this.update(ops.restoreCard(this.board, id, first.id));
    ui.notice('Card restored', { kind: 'success' });
  }
}
