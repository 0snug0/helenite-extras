// Settings → Secrets: lists secret *names*, shows set / not set, lets the user type a value (written straight to the
// keychain) or remove it. Values are never displayed or read back. Mountable by Session I or the lead:
// `app.setting.addCoreSettingTab(createSecretsSettingTab(deps))`.
// - Home: one row per secret (name, owner, set or not) with its Vaults policy; Home-only secrets say "Home only".
// - A vault: "From Home" (shared secrets the policy lets it use, read-only) and "This vault" (its own, editable).
import { Notice, PluginSettingTab, Setting, type App, type Plugin } from 'obsidian';
import type { SecretEntry, SecretVaultsPolicy } from '../main/connector-host';
import type { SecretAccess } from '../main/secrets';

export interface SecretsPolicyAccess {
  /** The vaults a policy can name (Home excluded). */
  vaults(): { uuid: string; name: string }[];
  /** Writes one shared secret's policy (`key` is `<scope>/<name>`); null resets it to "Allow all". */
  set(key: string, policy: SecretVaultsPolicy | null): void;
}

export interface SecretsTabDeps {
  app: App;
  plugin: Plugin;
  secrets: SecretAccess;
  /** `'unavailable'` shows the keychain-unavailable banner. */
  backend?: string;
  /** Current entries (re-read on every render so newly installed apps show up). */
  entries(): SecretEntry[];
  /** Home's window: the full list with Vaults policies. Otherwise the vault view. */
  isHome?: boolean;
  /** Home only: reads the vault list and writes policies. */
  policy?: SecretsPolicyAccess;
}

type Kind = 'all' | 'only' | 'except' | 'none';
const LABELS: [Kind, string][] = [
  ['all', 'Allow all'],
  ['only', 'Only these vaults'],
  ['except', 'All except these vaults'],
  ['none', 'Not available in vaults'],
];
const kindOf = (p: SecretVaultsPolicy): Kind => (typeof p === 'string' ? p : 'only' in p ? 'only' : 'except');
const allows = (p: SecretVaultsPolicy, uuid: string): boolean =>
  p === 'all' || (p !== 'none' && ('only' in p ? p.only.includes(uuid) : !p.except.includes(uuid)));
const setState = (e: SecretEntry) => (e.isSet ? 'set' : 'not set');

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
    const entries = deps.entries();
    if (deps.isHome) renderHome(this, entries);
    else renderVault(this, entries);
  };

  const rerender = (t: PluginSettingTab) => t.display();

  function renderHome(t: PluginSettingTab, entries: SecretEntry[]) {
    if (!entries.length) new Setting(t.containerEl).setName('No app or connector declares a secret yet.');
    for (const e of entries) {
      const row = new Setting(t.containerEl).setName(e.label).setDesc(`${e.name} · ${e.owner}${e.required ? ' · required' : ''} · ${setState(e)}`);
      if (e.class === 'shared') renderPolicy(t, row, e);
      else row.controlEl.createSpan({ text: 'Home only' });
      renderValue(t, row, e);
    }
  }

  function renderPolicy(t: PluginSettingTab, row: Setting, e: SecretEntry) {
    const cur = e.policy ?? 'all';
    const key = `${e.scope}/${e.name}`;
    const vaults = deps.policy?.vaults() ?? [];
    const commit = (p: SecretVaultsPolicy) => {
      try { deps.policy?.set(key, p === 'all' ? null : p); } catch (err) { new Notice(`Could not save: ${(err as Error).message}`); }
      rerender(t);
    };
    row.addDropdown((d) => {
      for (const [k, label] of LABELS) d.addOption(k, label);
      d.setValue(kindOf(cur)).onChange((k) => {
        if (k === 'all' || k === 'none') return commit(k);
        // A vault list starts from what the current policy allows.
        const allowed = vaults.map((v) => v.uuid).filter((u) => allows(cur, u));
        commit(k === 'only' ? { only: allowed } : { except: vaults.map((v) => v.uuid).filter((u) => !allowed.includes(u)) });
      });
    });
    if (typeof cur === 'string') return;
    const listed = 'only' in cur ? cur.only : cur.except;
    for (const v of vaults) {
      new Setting(t.containerEl).setName(v.name).addToggle((x) => x.setValue(listed.includes(v.uuid)).onChange((on) => {
        const ids = on ? [...listed, v.uuid] : listed.filter((u) => u !== v.uuid);
        commit('only' in cur ? { only: ids } : { except: ids });
      }));
    }
  }

  function renderVault(t: PluginSettingTab, entries: SecretEntry[]) {
    const shared = entries.filter((e) => e.class === 'shared');
    const own = entries.filter((e) => e.class !== 'shared' && e.class !== 'home');
    new Setting(t.containerEl).setName('From Home').setDesc('Shared by Home. Change them in Home’s Settings → Secrets.').setHeading();
    if (!shared.length) new Setting(t.containerEl).setName('Nothing from Home.');
    for (const e of shared) new Setting(t.containerEl).setName(e.label).setDesc(`${e.name} · ${e.owner} · ${setState(e)}`);
    new Setting(t.containerEl).setName('This vault').setHeading();
    if (!own.length) new Setting(t.containerEl).setName('No app or connector in this vault declares a secret yet.');
    const byOwner = new Map<string, SecretEntry[]>();
    for (const e of own) byOwner.set(e.owner, [...(byOwner.get(e.owner) ?? []), e]);
    for (const [owner, list] of byOwner) {
      new Setting(t.containerEl).setName(owner).setHeading();
      for (const e of list) renderValue(t, new Setting(t.containerEl).setName(e.label).setDesc(`${e.name}${e.required ? ' · required' : ''} · ${setState(e)}`), e);
    }
  }

  function renderValue(t: PluginSettingTab, row: Setting, e: SecretEntry) {
    if (e.managed) return;
    let value = '';
    row.addText((x) => { x.inputEl.type = 'password'; x.inputEl.autocomplete = 'off'; x.setPlaceholder(e.isSet ? '•••••• (enter a new value to replace)' : 'Paste value').onChange((v) => { value = v; }); });
    row.addButton((b) => b.setButtonText(e.isSet ? 'Replace' : 'Save').setCta().onClick(() => {
      if (!value) return void new Notice('Enter a value first.');
      try { deps.secrets.set(e.scope, e.name, value); new Notice(`${e.name} saved to the keychain.`); } catch (err) { new Notice(`Could not save: ${(err as Error).message}`); return; }
      rerender(t);
    }));
    if (e.isSet) row.addButton((b) => b.setButtonText('Remove').setWarning().onClick(() => {
      try { deps.secrets.delete(e.scope, e.name); } catch (err) { new Notice(`Could not remove: ${(err as Error).message}`); }
      rerender(t);
    }));
  }
  return tab;
}
