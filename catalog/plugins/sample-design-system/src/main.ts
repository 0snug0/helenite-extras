// Sample plugin for Helenite's design system (`import { ui } from 'helenite'`). Read docs/design-system/README.md first.
// It shows every part, and it has no stylesheet: the parts bring the look, in light and dark, with every theme.
// It is not a core plugin and is not enabled by default. Build it with `node scripts/build-plugin.mjs sample-design-system`.
import { Plugin } from 'obsidian';
// Imported statically because this plugin is Helenite-only. A plugin that also runs in Obsidian must guard the require
// (see "Plugins that run in Obsidian too" in docs/design-system/README.md).
import { ui, type CountBadgeHandle } from 'helenite';
import { count, readData, type Data, type Item, type Kind, type Status } from './data';
import { SampleSettingTab } from './settings';
import { SampleView, VIEW_TYPE } from './view';

export default class SampleDesignSystemPlugin extends Plugin {
  data: Data = readData(null);
  private status: HTMLElement | null = null;
  private count: CountBadgeHandle | null = null;

  async onload(): Promise<void> {
    this.data = readData(await this.loadData());
    this.registerView(VIEW_TYPE, (leaf) => new SampleView(leaf, this));
    this.addSettingTab(new SampleSettingTab(this.app, this));
    this.addRibbonIcon('plus', 'Add item', () => void this.addItem());
    const ribbon = this.addRibbonIcon('component', 'Show design-system parts', () => void this.openView());
    this.count = ui.countBadge(ribbon, 0, { overlay: true, label: 'open items' });
    // Status text in a status bar item takes the bar's size by itself.
    this.status = ui.statusText(this.addStatusBarItem(), '');
    this.addCommand({ id: 'show-parts', name: 'Show design-system parts', callback: () => void this.openView() });
    this.addCommand({ id: 'add-item', name: 'Add item', callback: () => void this.addItem() });
    this.showCounts();
  }

  /** Saves, then redraws everything that shows the items. */
  async save(): Promise<void> {
    await this.saveData(this.data);
    this.showCounts();
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE)) {
      if (leaf.view instanceof SampleView) leaf.view.refresh();
    }
  }

  private showCounts(): void {
    const open = this.data.items.filter((i) => i.status !== 'done').length;
    this.count?.set(open);
    this.status?.setText(count(open, 'open item'));
  }

  async openView(): Promise<void> {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(VIEW_TYPE)[0];
    if (!leaf) {
      leaf = workspace.getLeaf('tab');
      await leaf.setViewState({ type: VIEW_TYPE, active: true });
    }
    await workspace.revealLeaf(leaf);
  }

  /** The ribbon icon: a form modal, then a notice that echoes the values. */
  async addItem(): Promise<void> {
    const values = await ui.form(this.app, {
      title: 'Add item',
      action: 'Add',
      fields: [
        { id: 'name', kind: 'text', label: 'Name', placeholder: 'Item name' },
        { id: 'kind', kind: 'select', label: 'Kind', value: 'note', options: [{ value: 'note', label: 'Note' }, { value: 'link', label: 'Link' }] },
        { id: 'pinned', kind: 'checkbox', label: 'Pin it', detail: 'Marks it in the lists', value: false },
      ],
    });
    if (!values) return;
    const name = String(values.name).trim() || 'Untitled';
    const pinned = values.pinned === true;
    this.data.items.push({ id: String(Date.now()), name, kind: values.kind as Kind, status: 'todo', pinned });
    await this.save();
    ui.notice(`Added ${name} (${values.kind}${pinned ? ', pinned' : ''})`, { kind: 'success' });
  }

  async move(id: string, status: Status, index?: number): Promise<void> {
    const item = this.data.items.find((i) => i.id === id);
    if (!item) return;
    const rest = this.data.items.filter((i) => i !== item);
    item.status = status;
    // `index` is the place among the lane's other items; without one the item goes last.
    const before = index === undefined ? undefined : rest.filter((i) => i.status === status)[index];
    rest.splice(before ? rest.indexOf(before) : rest.length, 0, item);
    this.data.items = rest;
    await this.save();
  }

  async rename(item: Item): Promise<void> {
    const name = await ui.prompt(this.app, {
      title: 'Rename item', label: 'Name', value: item.name, action: 'Rename',
      validate: (v) => (v.trim() ? null : 'Enter a name.'),
    });
    if (name === null) return;
    item.name = name.trim();
    await this.save();
  }

  async remove(item: Item): Promise<void> {
    this.data.items = this.data.items.filter((i) => i.id !== item.id);
    await this.save();
    ui.notice(`Deleted ${item.name}`, { kind: 'success' });
  }
}
