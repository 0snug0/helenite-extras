// Settings → Secrets: lists secret *names* per app and connector, shows set / not set, lets the user type a value
// (written straight to the keychain) or remove it. Values are never displayed or read back. Mountable by Session I
// or the lead: `app.setting.addCoreSettingTab(createSecretsSettingTab(deps))`.
import { Notice, PluginSettingTab, Setting, type App, type Plugin } from 'obsidian';
import type { SecretEntry } from '../main/connector-host';
import type { SecretAccess } from '../main/secrets';

export interface SecretsTabDeps {
  app: App;
  plugin: Plugin;
  secrets: SecretAccess;
  /** `'unavailable'` shows the keychain-unavailable banner. */
  backend?: string;
  /** Current entries (re-read on every render so newly installed apps show up). */
  entries(): SecretEntry[];
}

export function createSecretsSettingTab(deps: SecretsTabDeps): PluginSettingTab {
  const tab = new PluginSettingTab(deps.app, deps.plugin);
  tab.id = 'secrets';
  tab.name = 'Secrets';
  tab.icon = 'key-round';
  tab.display = function display(this: PluginSettingTab) {
    const { containerEl } = this;
    containerEl.empty();
    const note = deps.backend === 'unavailable' ? 'The system keychain is unavailable, so secrets cannot be saved right now.' : 'Stored in the system keychain. Helenite never shows a saved value again.';
    new Setting(containerEl).setName('Secrets').setDesc(note).setHeading();
    const byOwner = new Map<string, SecretEntry[]>();
    for (const e of deps.entries()) byOwner.set(e.owner, [...(byOwner.get(e.owner) ?? []), e]);
    if (!byOwner.size) new Setting(containerEl).setName('No app or connector declares a secret yet.');
    for (const [owner, list] of byOwner) {
      new Setting(containerEl).setName(owner).setHeading();
      for (const e of list) renderEntry(this, e);
    }
    renderAccountsPointer(this);
  };

  const rerender = (t: PluginSettingTab) => t.display();

  function renderEntry(t: PluginSettingTab, e: SecretEntry) {
    const row = new Setting(t.containerEl).setName(e.label).setDesc(`${e.name}${e.required ? ' · required' : ''} · ${e.isSet ? 'set' : 'not set'}`);
    if (e.managed) return;
    let value = '';
    row.addText((x) => { x.inputEl.type = 'password'; x.inputEl.autocomplete = 'off'; x.setPlaceholder(e.isSet ? '•••••• (enter a new value to replace)' : 'Paste value').onChange((v) => { value = v; }); });
    row.addButton((b) => b.setButtonText('Save').setCta().onClick(() => {
      if (!value) return void new Notice('Enter a value first.');
      try { deps.secrets.set(e.scope, e.name, value); new Notice(`${e.name} saved to the keychain.`); } catch (err) { new Notice(`Could not save: ${(err as Error).message}`); return; }
      rerender(t);
    }));
    if (e.isSet) row.addButton((b) => b.setButtonText('Remove').setWarning().onClick(() => { deps.secrets.delete(e.scope, e.name); rerender(t); }));
  }

  function renderAccountsPointer(t: PluginSettingTab) {
    new Setting(t.containerEl).setName('Google Calendar').setDesc('Calendar and mail sign-ins are accounts now. Manage in Settings → Accounts.');
  }
  return tab;
}
