// Settings → Secrets: lists secret *names*, shows set / not set, lets the user type a value (written straight to the
// keychain) or remove it. Values are never displayed or read back. Mountable by Session I or the lead:
// `app.setting.addCoreSettingTab(createSecretsSettingTab(deps))`.
// - Home: one row per secret (name, owner, set or not) with its Vaults policy; Home-only secrets say "Home only".
// - A vault: "From Home" (shared secrets the policy lets it use, read-only) and "This vault" (its own, editable).
import { PluginSettingTab, Setting, type App, type Plugin } from 'obsidian';
import { ui, type VaultScope } from 'helenite';
import type { SecretEntry, SecretVaultsPolicy } from '../main/connector-host';
import type { SecretAccess } from '../main/secrets';

export interface SecretsPolicyAccess {
  /** The vaults a policy can name (Home excluded). */
  vaults(): { uuid: string; name: string }[];
  /** Writes one shared secret's policy (`key` is `<scope>/<name>`); null resets it to "Allow all". */
  set(key: string, policy: SecretVaultsPolicy | null): void;
  /** Home's policy file exists but can't be read: every vault is denied until a policy is written. */
  unreadable?(): boolean;
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

const setState = (e: SecretEntry) => (e.isSet ? 'set' : 'not set');

export function createSecretsSettingTab(deps: SecretsTabDeps): PluginSettingTab {
  const tab: PluginSettingTab = new (class extends PluginSettingTab { display(): void {} })(deps.app, deps.plugin);
  tab.id = 'secrets';
  tab.name = 'Secrets';
  tab.icon = 'key-round';
  tab.display = function display(this: PluginSettingTab) {
    const { containerEl } = this;
    containerEl.empty();
    const note = deps.backend === 'unavailable' ? 'The system keychain is unavailable, so secrets cannot be saved right now.' : 'Stored in the system keychain. Helenite never shows a saved value again.';
    const top = ui.settings.section(containerEl, 'Secrets', { desc: note });
    const entries = deps.entries();
    if (deps.isHome) renderHome(this, top, entries);
    else renderVault(this, entries);
  };

  const rerender = (t: PluginSettingTab) => t.display();

  function renderHome(t: PluginSettingTab, el: HTMLElement, entries: SecretEntry[]) {
    if (deps.policy?.unreadable?.()) {
      ui.callout(el, { tone: 'warning', text: "The vault access file can't be read. Change any secret's Vaults setting to rewrite it." }).el.dataset.unreadable = '';
    }
    if (!entries.length) ui.emptyState(el, 'No app or connector declares a secret yet.', { variant: 'inline' });
    for (const e of entries) {
      const row = secretRow(el, e, `${e.name} · ${e.owner}${e.required ? ' · required' : ''} · ${setState(e)}`);
      if (e.class !== 'shared') ui.badge(row.controlEl, 'Home only');
      renderValue(t, row, e);
      if (e.class === 'shared') renderPolicy(t, el, e);
    }
  }

  /** A secret's row; it carries `data-secret="<scope>/<name>"`. */
  function secretRow(el: HTMLElement, e: SecretEntry, desc: string): Setting {
    const row = new Setting(el).setName(e.label).setDesc(desc);
    row.settingEl.dataset.secret = `${e.scope}/${e.name}`;
    return row;
  }

  /** A shared secret's Vaults row under it: ui.settings.vaultScope (the policy has no "off by default"). */
  function renderPolicy(t: PluginSettingTab, parent: HTMLElement, e: SecretEntry) {
    const key = `${e.scope}/${e.name}`;
    const vaults = (deps.policy?.vaults() ?? []).map((v) => ({ id: v.uuid, name: v.name }));
    const el = parent.createDiv();
    el.dataset.access = key;
    ui.settings.vaultScope(el, {
      value: (e.policy ?? 'all') as VaultScope,
      vaults,
      onChange: (p) => {
        try {
          deps.policy?.set(key, p === 'all' ? null : (p as SecretVaultsPolicy));
        } catch (err) {
          ui.notice(`Could not save: ${(err as Error).message}`, { kind: 'error' });
        }
        rerender(t);
      },
    });
  }

  function renderVault(t: PluginSettingTab, entries: SecretEntry[]) {
    const shared = entries.filter((e) => e.class === 'shared');
    const own = entries.filter((e) => e.class !== 'shared' && e.class !== 'home');
    const fromHome = ui.settings.section(t.containerEl, 'From Home', { desc: 'Shared by Home. Change them in Home’s Settings → Secrets.' });
    if (!shared.length) ui.emptyState(fromHome, 'Nothing from Home.', { variant: 'inline' });
    for (const e of shared) secretRow(fromHome, e, `${e.name} · ${e.owner} · ${setState(e)}`);
    const mine = ui.settings.section(t.containerEl, 'This vault');
    if (!own.length) ui.emptyState(mine, 'No app or connector in this vault declares a secret yet.', { variant: 'inline' });
    const byOwner = new Map<string, SecretEntry[]>();
    for (const e of own) byOwner.set(e.owner, [...(byOwner.get(e.owner) ?? []), e]);
    for (const [owner, list] of byOwner) {
      const section = ui.settings.section(mine, owner);
      for (const e of list) renderValue(t, secretRow(section, e, `${e.name}${e.required ? ' · required' : ''} · ${setState(e)}`), e);
    }
  }

  /** The value box (a password input, never filled) with Save or Replace, and Remove once set. OAuth tokens have none. */
  function renderValue(t: PluginSettingTab, row: Setting, e: SecretEntry) {
    if (e.managed) return;
    const save = () => {
      if (!input.value) return void ui.notice('Enter a value first.');
      try {
        deps.secrets.set(e.scope, e.name, input.value);
        ui.notice(`${e.name} saved to the keychain.`, { kind: 'success' });
      } catch (err) {
        ui.notice(`Could not save: ${(err as Error).message}`, { kind: 'error' });
        return;
      }
      rerender(t);
    };
    const input = ui.textInput(row.controlEl, {
      secret: true,
      label: `${e.label} value`,
      placeholder: e.isSet ? '•••••• (enter a new value to replace)' : 'Paste value',
      onEnter: save,
    });
    input.autocomplete = 'off';
    ui.button(row.controlEl, { text: e.isSet ? 'Replace' : 'Save', variant: 'primary', onClick: save });
    if (e.isSet) ui.action(row.controlEl, 'remove', {
      app: deps.app,
      subject: e.name,
      message: `Remove ${e.name} from the keychain?`,
      onClick: () => {
        try { deps.secrets.delete(e.scope, e.name); } catch (err) { ui.notice(`Could not remove: ${(err as Error).message}`, { kind: 'error' }); }
        rerender(t);
      },
    });
  }
  return tab;
}
