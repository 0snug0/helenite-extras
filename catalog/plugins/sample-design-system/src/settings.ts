// The settings tab: every `ui.settings` part.
import { PluginSettingTab, type App } from 'obsidian';
import { ui } from 'helenite';
import { count } from './data';
import { itemTable } from './item-parts';
import type SampleDesignSystemPlugin from './main';

export class SampleSettingTab extends PluginSettingTab {
  constructor(app: App, private plugin: SampleDesignSystemPlugin) {
    super(app, plugin);
  }

  display(): void {
    const { plugin } = this;
    const el = this.containerEl;
    el.empty();
    const items = ui.settings.section(el, 'Items');
    const manage = ui.settings.subpageRow(this.app, items, {
      name: 'Manage items',
      desc: count(plugin.data.items.length, 'item'),
      title: 'Items',
      // The tab stays drawn under the sub-page, so a change there updates this row too.
      render: (page) => this.renderItems(page, () => manage.setDesc(count(plugin.data.items.length, 'item'))),
    });
    ui.settings.summaryRow(items, {
      name: 'About this sample', desc: 'Where to see every part.', chevron: true,
      onClick: () => ui.settings.openSubpage(this.app, 'About this sample', (page) => {
        ui.callout(page, { tone: 'info', text: 'The component ribbon icon, or the command “Show design-system parts”, opens a tab with every part.' });
      }),
    });
    new ui.settings.row(items)
      .setName('Two-line rows')
      .setDesc('Show details under each item.')
      .addToggle((t) => t.setValue(plugin.data.density === 'detailed').onChange((on) => {
        plugin.data.density = on ? 'detailed' : 'compact';
        void plugin.save();
      }));
    new ui.settings.row(items)
      .setName('Sync')
      .setDesc('Not available in this sample.')
      .addDropdown((d) => d.addOption('off', 'Off'))
      .setDisabled(true);

    const access = ui.settings.section(el, 'Access', { desc: 'Demo values: nothing is shared.' });
    const card = ui.settings.card(access, { name: 'Item sync', desc: 'sample', icon: 'refresh-cw', status: { text: 'Not connected', tone: 'warning' } });
    ui.action(card.head.controlEl, 'reconnect', { onClick: () => card.setStatus({ text: 'Connected', tone: 'success' }) });
    ui.settings.vaultScope(card.body, {
      value: plugin.data.scope,
      vaults: [{ id: 'work', name: 'Work' }, { id: 'notes', name: 'Notes' }, { id: 'old', name: 'Archive', disabled: 'Closed vault' }],
      homeNote: true,
      confirmAll: () => ui.confirm(this.app, { title: 'Allow all vaults', message: 'Let every vault use item sync?', action: 'Allow all' }),
      onChange: (scope) => {
        plugin.data.scope = scope;
        void plugin.save();
      },
    });

    // Helenite draws this bar above a Home plugin's page by itself, so a plugin rarely needs to. This one is a demo.
    const scope = ui.settings.section(el, 'Scope bar', { desc: 'For a page that edits both Home and the Vault Defaults.' });
    ui.settings.scopeBar(scope, { editingDefaults: false, onChange: () => {} });
  }

  private renderItems(page: HTMLElement, onChange: () => void): void {
    // Nothing else redraws the table: after a delete it takes the new rows, and the sub-page stays open.
    const table = itemTable(page, this.plugin, this.plugin.data.items, () => {
      table.setRows(this.plugin.data.items);
      onChange();
    });
  }
}
