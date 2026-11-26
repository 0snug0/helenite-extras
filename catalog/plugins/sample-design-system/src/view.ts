// The "Design-system parts" tab: a pane header, tabs, and one page per tab.
import { ItemView, type WorkspaceLeaf } from 'obsidian';
import { ui, type TabsHandle } from 'helenite';
import type SampleDesignSystemPlugin from './main';
import { drawBoard } from './pages/board';
import { drawCards } from './pages/cards';
import { drawDialogs } from './pages/dialogs';
import { drawInputs } from './pages/inputs';
import { drawItems, type ItemFilter } from './pages/items';
import { drawStatus } from './pages/status';

export const VIEW_TYPE = 'sample-design-system';

export const PAGES = [
  { id: 'items', text: 'Items' },
  { id: 'board', text: 'Board' },
  { id: 'inputs', text: 'Inputs' },
  { id: 'status', text: 'Status' },
  { id: 'cards', text: 'Cards' },
  { id: 'dialogs', text: 'Dialogs' },
] as const;

export type PageId = (typeof PAGES)[number]['id'];

export class SampleView extends ItemView {
  page: PageId = 'items';
  private tabs: TabsHandle<PageId> | null = null;
  private header: HTMLElement | null = null;
  private dragging = false;
  private stale = false;
  /** Kept here so a redraw after a save does not lose the search or the layout. */
  private filter: ItemFilter = { query: '', kind: 'all', layout: 'list' };

  constructor(leaf: WorkspaceLeaf, private plugin: SampleDesignSystemPlugin) {
    super(leaf);
  }

  getViewType(): string {
    return VIEW_TYPE;
  }

  getDisplayText(): string {
    return 'Design-system parts';
  }

  getIcon(): string {
    return 'component';
  }

  async onOpen(): Promise<void> {
    this.contentEl.empty();
    this.tabs = ui.tabs<PageId>(this.contentEl, {
      tabs: PAGES.map((p) => ({ ...p })),
      value: this.page,
      onSelect: (id) => {
        this.page = id;
        this.drawPage();
      },
    });
    this.refresh();
  }

  /** Redraws what shows the plugin's data, after a drag if one is under way. The Inputs page holds what the user typed, so it is left alone. */
  refresh(): void {
    if (this.dragging) {
      this.stale = true;
      return;
    }
    this.drawHeader();
    this.tabs?.setBadge('items', this.plugin.data.items.length);
    // Right after opening there is no page yet.
    if (this.page !== 'inputs' || !this.tabs?.el.nextElementSibling) this.drawPage();
  }

  private hold(dragging: boolean): void {
    this.dragging = dragging;
    if (dragging || !this.stale) return;
    this.stale = false;
    this.refresh();
  }

  private drawHeader(): void {
    this.header?.remove();
    this.header = ui.paneHeader(this.contentEl, [
      { icon: 'plus', label: 'Add item', id: 'add', onClick: () => void this.plugin.addItem() },
      // One line or two per row. The header is rebuilt on a change, so the icon follows.
      ui.densityAction(this.plugin.data.density, (density) => {
        this.plugin.data.density = density;
        void this.plugin.save();
      }),
    ]);
  }

  private drawPage(): void {
    const el = this.contentEl;
    while (this.tabs?.el.nextSibling) this.tabs.el.nextSibling.remove();
    // A board fills its pane: the class goes on the board's container, and the board is drawn straight into it.
    el.toggleClass('hel-board-page', this.page === 'board');
    if (this.page === 'board') return drawBoard(el, this.plugin, (dragging) => this.hold(dragging));
    const page = el.createDiv();
    if (this.page === 'items') drawItems(page, this.plugin, this.filter);
    else if (this.page === 'inputs') drawInputs(page);
    else if (this.page === 'status') drawStatus(page);
    else if (this.page === 'cards') drawCards(page);
    else drawDialogs(page, this.plugin);
  }
}
