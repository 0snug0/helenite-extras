// Sample plugin for Helenite's design system (`import { ui } from 'helenite'`). Read docs/design-system/README.md first.
// It is not a core plugin and is not enabled by default. Build it with `node plugins/core-build/build.mjs sample-design-system`.
import { Plugin, PluginSettingTab, type App } from 'obsidian';
import { ui } from 'helenite';

interface Item {
  id: string;
  name: string;
  kind: string;
}

interface Data {
  items: Item[];
  editingDefaults: boolean;
}

export default class SampleDesignSystemPlugin extends Plugin {
  data: Data = { items: [], editingDefaults: false };

  async onload(): Promise<void> {
    const saved = ((await this.loadData()) ?? {}) as Partial<Data>;
    this.data = {
      items: saved.items ?? [{ id: '1', name: 'First item', kind: 'note' }, { id: '2', name: 'Second item', kind: 'link' }],
      editingDefaults: saved.editingDefaults ?? false,
    };
    this.addSettingTab(new SampleSettingTab(this.app, this));
    this.addRibbonIcon('plus', 'Add item', () => void this.addItem());
  }

  save(): Promise<void> {
    return this.saveData(this.data);
  }

  /** The ribbon icon: a form modal, then a notice that echoes the values. */
  async addItem(): Promise<void> {
    const values = await ui.form(this.app, {
      title: 'Add item',
      action: 'Add',
      fields: [
        { id: 'name', kind: 'text', label: 'Name', placeholder: 'Item name' },
        { id: 'kind', kind: 'select', label: 'Kind', value: 'note', options: [{ value: 'note', label: 'Note' }, { value: 'link', label: 'Link' }] },
        { id: 'pinned', kind: 'checkbox', label: 'Pin it', value: false },
      ],
    });
    if (!values) return;
    const name = String(values.name).trim() || 'Untitled';
    this.data.items.push({ id: String(Date.now()), name, kind: String(values.kind) });
    await this.save();
    ui.notice(`Added ${name} (${values.kind}${values.pinned ? ', pinned' : ''})`, { kind: 'success' });
  }
}

class SampleSettingTab extends PluginSettingTab {
  constructor(app: App, private plugin: SampleDesignSystemPlugin) {
    super(app, plugin);
  }

  display(): void {
    const el = this.containerEl;
    el.empty();
    ui.settings.scopeBar(el, {
      editingDefaults: this.plugin.data.editingDefaults,
      onChange: (editingDefaults) => {
        this.plugin.data.editingDefaults = editingDefaults;
        void this.plugin.save();
      },
    });
    const rows = ui.settings.section(el, 'Items');
    ui.settings.subpageRow(this.app, rows, {
      name: 'Manage items',
      desc: `${this.plugin.data.items.length} items`,
      title: 'Items',
      render: (page) => this.renderItems(page),
    });
  }

  private renderItems(page: HTMLElement): void {
    const t = ui.table<Item>(page, {
      columns: [
        { key: 'name', title: 'Name', cell: (r) => r.name },
        { key: 'kind', title: 'Kind', cell: (r, td) => void ui.badge(td, r.kind) },
      ],
      rows: this.plugin.data.items,
      empty: 'No items yet.',
      actions: (r, cell) => {
        ui.action(cell, 'delete', {
          app: this.app,
          subject: r.name,
          onClick: async () => {
            this.plugin.data.items = this.plugin.data.items.filter((i) => i.id !== r.id);
            await this.plugin.save();
            t.setRows(this.plugin.data.items);
            ui.notice(`Deleted ${r.name}`, { kind: 'success' });
          },
        });
      },
    });
  }
}
