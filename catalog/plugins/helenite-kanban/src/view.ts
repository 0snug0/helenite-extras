// The board view: a TextFileView over a board note. Edits go through ops.ts and are written straight back to the note.
import { MarkdownRenderer, TextFileView, type WorkspaceLeaf } from 'obsidian';
import { ui, type MenuItemSpec } from 'helenite';
import { parseBoard, serializeBoard, type Board, type Card, type Lane } from './board';
import * as ops from './ops';

export const VIEW_TYPE = 'helenite-kanban';

/** In a prompt, a card's line breaks are shown as <br> (the board format reads <br> back as a line break). */
const toPrompt = (text: string): string => text.replace(/\r?\n/g, '<br>');
const fromPrompt = (text: string): string => text.replace(/<br>/g, '\n');
const firstLine = (text: string): string => text.split('\n')[0] || '(empty card)';
const required = (what: string) => (v: string) => (v.trim() ? null : `Enter a ${what}.`);

export interface KanbanHost {
  /** Reopen the leaf as a plain markdown note. */
  openAsMarkdown(leaf: WorkspaceLeaf): void;
}

export class KanbanView extends TextFileView {
  board: Board = parseBoard('');
  /** Only an edit made here rewrites the note; just viewing a hand-written board leaves its layout alone. */
  private dirty = false;
  private dragId: string | null = null;

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

  setViewData(data: string, _clear: boolean): void {
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
    const root = this.contentEl;
    root.empty();
    root.addClass('helenite-kanban-view');
    const bar = root.createDiv({ cls: 'helenite-kanban-toolbar' });
    ui.button(bar, { text: 'Add list', icon: 'plus', onClick: () => this.addLane() });
    if (this.board.archive.length) {
      ui.button(bar, { text: `Archived cards (${this.board.archive.length})`, icon: 'archive', onClick: () => this.restoreFromArchive() });
    }
    const lanes = root.createDiv({ cls: 'helenite-kanban-lanes' });
    if (!this.board.lanes.length) {
      ui.emptyState(lanes, 'No lists yet. Add a list to start the board.');
      return;
    }
    this.board.lanes.forEach((lane, i) => this.renderLane(lanes, lane, i));
  }

  private renderLane(parent: HTMLElement, lane: Lane, index: number): void {
    const el = parent.createDiv({ cls: 'helenite-kanban-lane' });
    el.dataset.laneId = lane.id;
    const head = el.createDiv({ cls: 'helenite-kanban-lane-header' });
    const title = head.createDiv({ cls: 'helenite-kanban-lane-title', text: lane.title || 'Untitled list' });
    title.setAttribute('role', 'button');
    title.tabIndex = 0;
    title.addEventListener('click', () => void this.renameLane(lane));
    const count = lane.maxItems ? `${lane.cards.length}/${lane.maxItems}` : String(lane.cards.length);
    ui.badge(head, count, lane.maxItems && lane.cards.length > lane.maxItems ? 'danger' : lane.markComplete ? 'success' : 'default');
    ui.moreButton(head, () => this.laneMenu(lane, index), 'List options');

    const cards = el.createDiv({ cls: 'helenite-kanban-cards' });
    this.wireDrop(cards, lane);
    if (!lane.cards.length) cards.createDiv({ cls: 'helenite-kanban-placeholder', text: 'No cards' });
    for (const card of lane.cards) this.renderCard(cards, card, lane);
    ui.button(el, { text: 'Add a card', icon: 'plus', variant: 'link', onClick: () => this.addCard(lane) });
  }

  private renderCard(parent: HTMLElement, card: Card, lane: Lane): void {
    const el = parent.createDiv({ cls: 'helenite-kanban-card' });
    el.toggleClass('is-done', card.checked);
    el.dataset.cardId = card.id;
    el.draggable = true;
    el.addEventListener('dragstart', (e) => {
      this.dragId = card.id;
      e.dataTransfer?.setData('text/plain', card.id);
      el.addClass('is-dragging');
    });
    el.addEventListener('dragend', () => {
      this.dragId = null;
      el.removeClass('is-dragging');
    });
    const check = el.createEl('input', { cls: 'task-list-item-checkbox helenite-kanban-check', type: 'checkbox' });
    check.checked = card.checked;
    check.setAttribute('aria-label', card.checked ? 'Mark card as not done' : 'Mark card as done');
    check.addEventListener('click', (e) => {
      e.stopPropagation();
      this.update(ops.toggleCard(this.board, card.id));
    });
    const body = el.createDiv({ cls: 'helenite-kanban-card-text' });
    void MarkdownRenderer.render(this.app, card.text, body, this.file?.path ?? '', this);
    body.addEventListener('dblclick', () => void this.editCard(card));
    ui.moreButton(el, () => this.cardMenu(card, lane), 'Card options');
  }

  /** Cards can be dropped anywhere in a lane; the drop position is the first card whose middle is below the pointer. */
  private wireDrop(cards: HTMLElement, lane: Lane): void {
    cards.addEventListener('dragover', (e) => {
      if (!this.dragId) return;
      e.preventDefault();
      cards.addClass('is-drop-target');
    });
    cards.addEventListener('dragleave', () => cards.removeClass('is-drop-target'));
    cards.addEventListener('drop', (e) => {
      cards.removeClass('is-drop-target');
      const id = this.dragId ?? e.dataTransfer?.getData('text/plain');
      if (!id) return;
      e.preventDefault();
      const items = Array.from(cards.querySelectorAll<HTMLElement>('.helenite-kanban-card'));
      let to = items.findIndex((c) => {
        const r = c.getBoundingClientRect();
        return e.clientY < r.top + r.height / 2;
      });
      if (to < 0) to = items.length;
      this.update(ops.moveCard(this.board, id, lane.id, to));
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
