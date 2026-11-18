// Kanban: first-party Helenite port of the Obsidian Kanban plugin (obsidian-kanban). Board notes are plain markdown in
// that plugin's format (see board.ts), so the same files work in both apps.
import { MarkdownView, Plugin, TFile, TFolder, type WorkspaceLeaf } from 'obsidian';
import { ui } from 'helenite';
import { isBoardFrontmatter, isBoardMarkdown, newBoardMarkdown } from './board';
import { KanbanView, VIEW_TYPE, type KanbanHost } from './view';

export default class KanbanPlugin extends Plugin implements KanbanHost {
  /** Leaves the user switched to markdown, with the note they did it for. They stay markdown until the note changes. */
  private asMarkdown = new WeakMap<WorkspaceLeaf, string>();

  async onload(): Promise<void> {
    this.registerView(VIEW_TYPE, (leaf: WorkspaceLeaf) => new KanbanView(leaf, this));
    this.addRibbonIcon('square-kanban', 'New board', () => void this.createBoard());
    this.addCommand({ id: 'create-board', name: 'New board', callback: () => void this.createBoard() });
    this.addCommand({
      id: 'toggle-view',
      name: 'Switch between board and markdown',
      checkCallback: (checking: boolean) => {
        const leaf = this.app.workspace.activeLeaf ?? this.app.workspace.getMostRecentLeaf();
        const view = leaf?.view;
        if (view instanceof KanbanView) {
          if (!checking) this.openAsMarkdown(leaf!);
          return true;
        }
        if (view instanceof MarkdownView && view.file && this.isBoard(view.file)) {
          if (!checking) void this.openAsBoard(leaf!, view.file);
          return true;
        }
        return false;
      },
    });
    this.registerEvent(
      this.app.workspace.on('file-menu', (menu: any, file: any, _source: string, leaf?: WorkspaceLeaf) => {
        if (file instanceof TFolder) {
          menu.addItem((i: any) => i.setTitle('New board').setIcon('square-kanban').onClick(() => void this.createBoard(file)));
        } else if (file instanceof TFile && leaf?.view instanceof MarkdownView && this.isBoard(file)) {
          menu.addItem((i: any) => i.setTitle('Open as board').setIcon('square-kanban').onClick(() => void this.openAsBoard(leaf, file)));
        }
      }),
    );
    // A board note opens as a board, unless the user asked for markdown in that tab.
    this.registerEvent(this.app.workspace.on('file-open', () => void this.switchActiveLeaf()));
    this.app.workspace.onLayoutReady(() => {
      this.app.workspace.iterateRootLeaves?.((leaf: WorkspaceLeaf) => void this.maybeSwitch(leaf));
    });
  }

  /** True when the note is a board, by its cached frontmatter. */
  isBoard(file: TFile): boolean {
    return isBoardFrontmatter(this.app.metadataCache.getFileCache(file)?.frontmatter);
  }

  private async switchActiveLeaf(): Promise<void> {
    const leaf = this.app.workspace.activeLeaf ?? this.app.workspace.getMostRecentLeaf();
    if (leaf) await this.maybeSwitch(leaf);
  }

  private async maybeSwitch(leaf: WorkspaceLeaf): Promise<void> {
    const view = leaf.view;
    if (!(view instanceof MarkdownView) || !view.file) return;
    const file = view.file;
    const pinned = this.asMarkdown.get(leaf);
    if (pinned === file.path) return;
    if (pinned) this.asMarkdown.delete(leaf);
    // The cache may not have the note yet right after it was created; fall back to reading it.
    const board = this.app.metadataCache.getFileCache(file) ? this.isBoard(file) : isBoardMarkdown(await this.app.vault.cachedRead(file));
    if (board) await this.openAsBoard(leaf, file);
  }

  async openAsBoard(leaf: WorkspaceLeaf, file: TFile): Promise<void> {
    this.asMarkdown.delete(leaf);
    await leaf.setViewState({ type: VIEW_TYPE, state: { file: file.path }, active: true } as any);
  }

  openAsMarkdown(leaf: WorkspaceLeaf): void {
    const file = (leaf.view as KanbanView).file;
    if (!file) return;
    this.asMarkdown.set(leaf, file.path);
    void leaf.setViewState({ type: 'markdown', state: { file: file.path }, active: true } as any);
  }

  /** Create "Untitled Kanban.md" (or the next free name) in `folder`, or where new notes go, and open it. */
  async createBoard(folder?: TFolder): Promise<void> {
    const parent = folder ?? this.app.fileManager.getNewFileParent(this.app.workspace.getActiveFile()?.path ?? '');
    const dir = parent && !parent.isRoot() ? `${parent.path}/` : '';
    let path = `${dir}Untitled Kanban.md`;
    for (let n = 1; this.app.vault.getAbstractFileByPath(path); n++) path = `${dir}Untitled Kanban ${n}.md`;
    try {
      const file = await this.app.vault.create(path, newBoardMarkdown());
      await this.openAsBoard(this.app.workspace.getLeaf(false), file);
    } catch (e) {
      ui.notice(`Could not create the board: ${e instanceof Error ? e.message : String(e)}`, { kind: 'error' });
    }
  }
}
