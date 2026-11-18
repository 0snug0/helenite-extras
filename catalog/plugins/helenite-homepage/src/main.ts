// Homepage: first-party Helenite port of the Obsidian Homepage plugin (id `homepage`). Opens a chosen note when
// Helenite starts, from a command or ribbon icon, and optionally in every new empty tab.
import { Plugin, TFile, type WorkspaceLeaf } from 'obsidian';
import { ui } from 'helenite';
import { openStateFor, planOpen, readSettings, resolveTarget, type HomepageSettings, type TabInfo } from './homepage';
import { HomepageSettingTab } from './settings';

export default class HomepagePlugin extends Plugin {
  settings: HomepageSettings = readSettings(undefined);
  /** Main-area tabs that existed already, so only tabs opened later count as new. */
  private seen = new WeakSet<WorkspaceLeaf>();

  async onload(): Promise<void> {
    this.settings = readSettings(await this.loadData());
    this.addSettingTab(new HomepageSettingTab(this.app, this));
    this.addRibbonIcon('home', 'Open homepage', () => void this.openHomepage());
    this.addCommand({ id: 'open', name: 'Open homepage', callback: () => void this.openHomepage() });

    // Turning the plugin on mid-session is not a startup: only open on startup when the layout is still loading.
    const atStartup = !this.app.workspace.layoutReady;
    this.app.workspace.onLayoutReady(async () => {
      this.app.workspace.iterateRootLeaves((leaf: WorkspaceLeaf) => void this.seen.add(leaf));
      if (atStartup && this.settings.openOnStartup) await this.openHomepage();
      const check = () => this.checkNewTabs();
      this.registerEvent(this.app.workspace.on('layout-change', check));
      this.registerEvent(this.app.workspace.on('active-leaf-change', check));
    });
  }

  async save(): Promise<void> {
    await this.saveData(this.settings);
  }

  /** A main-area tab that appeared since the last check and is still empty once its opener has had a turn. */
  private checkNewTabs(): void {
    const fresh: WorkspaceLeaf[] = [];
    this.app.workspace.iterateRootLeaves((leaf: WorkspaceLeaf) => {
      if (this.seen.has(leaf)) return;
      this.seen.add(leaf);
      fresh.push(leaf);
    });
    if (!this.settings.openInNewTab || !fresh.length) return;
    // A tab opened for a file is empty for a moment; wait until whoever opened it has set its view.
    window.setTimeout(() => {
      for (const leaf of fresh) {
        if (leaf.view?.getViewType() === 'empty' && !(leaf as any).working) void this.openHomepage(leaf);
      }
    }, 0);
  }

  private tabs(): { info: TabInfo[]; leaves: WorkspaceLeaf[] } {
    const ws = this.app.workspace;
    // activeLeaf when it is in the main area; activeTime ties within a millisecond make getMostRecentLeaf unreliable.
    const active = ws.activeLeaf?.getRoot() === ws.rootSplit ? ws.activeLeaf : ws.getMostRecentLeaf();
    const leaves: WorkspaceLeaf[] = [];
    ws.iterateRootLeaves((leaf: WorkspaceLeaf) => void leaves.push(leaf));
    const info = leaves.map((leaf, i) => ({
      id: String(i),
      path: ((leaf.view as any)?.file as TFile | undefined)?.path ?? null,
      empty: leaf.view?.getViewType() === 'empty',
      pinned: !!leaf.getViewState().pinned,
      active: leaf === active,
    }));
    return { info, leaves };
  }

  /** Open the homepage the way the settings say, or into `into` (a new empty tab). */
  async openHomepage(into?: WorkspaceLeaf): Promise<void> {
    const { vault, workspace } = this.app;
    const s = this.settings;
    const res = resolveTarget(s, {
      exists: (p) => !!vault.getAbstractFileByPath(p),
      notes: () => vault.getMarkdownFiles().map((f) => f.path),
      random: Math.random,
    });
    if (!res.ok) {
      ui.notice(`Could not open the homepage. ${res.reason}`, { kind: 'error' });
      return;
    }
    let file = vault.getAbstractFileByPath(res.path);
    if (res.create) {
      try {
        const dir = res.path.includes('/') ? res.path.slice(0, res.path.lastIndexOf('/')) : '';
        if (dir && !vault.getAbstractFileByPath(dir)) await vault.createFolder(dir);
        file = await vault.create(res.path, '');
      } catch (e) {
        ui.notice(`Could not create ${res.path}: ${e instanceof Error ? e.message : String(e)}`, { kind: 'error' });
        return;
      }
    }
    if (!(file instanceof TFile)) {
      ui.notice(`Could not open the homepage. ${res.path} is not a file.`, { kind: 'error' });
      return;
    }
    const open = { ...openStateFor(s.view), active: true };
    if (into) {
      await into.openFile(file, open);
      return;
    }

    const { info, leaves } = this.tabs();
    const plan = planOpen(info, file.path, s.openMode, s.refresh);
    let leaf = plan.leaf !== null ? leaves[Number(plan.leaf)] : null;
    if (leaf && plan.action !== 'open') {
      if (plan.action === 'reload') await (leaf as any).rebuildView?.();
      workspace.setActiveLeaf(leaf, { focus: true });
    } else {
      if (!leaf) {
        leaf = workspace.getLeaf('tab');
        this.seen.add(leaf);
      }
      await leaf.openFile(file, open);
    }
    for (const id of plan.close) leaves[Number(id)]?.detach();
  }
}
