// Settings → Data: each reference contract, the connectors bound to it (in order, with status badges), add / remove /
// move up / move down, per-connector settings, and a Review button for vault connectors. Written against a structural
// `DataClient` (matching `window.helenite.data`) so this package never imports desktop code. Every name, id and message
// shown here is vault-controlled, so it only ever goes through `setName` / `setDesc` (text), never HTML.
import { Notice, PluginSettingTab, Setting, type App, type Plugin } from 'obsidian';
import type { ContractStatus, DataFile } from '../data';
import type { SettingSpec, SettingValue } from '../sdk';

export interface DataStatusView {
  contracts: ContractStatus[];
  connectors: { id: string; kind: 'built-in' | 'vault'; state: string; error?: string }[];
  data: DataFile;
}

export interface DataClient {
  status(): Promise<DataStatusView>;
  /** Only the vault connector's manifest settings are read from this. */
  review(id: string): Promise<{ manifest: { settings: Record<string, SettingSpec> } | null }>;
  save(f: DataFile): Promise<void>;
}

export interface DataTabDeps {
  app: App;
  plugin: Plugin;
  data: DataClient;
  openReview(id: string): void;
}

const BADGE: Record<string, string> = { ready: 'ready', 'waiting-review': 'waiting for review', rejected: 'rejected', missing: 'missing' };

export function createDataSettingTab(deps: DataTabDeps): PluginSettingTab {
  const tab = new PluginSettingTab(deps.app, deps.plugin);
  tab.id = 'data';
  tab.name = 'Data';
  tab.icon = 'database';
  let token = 0;
  // `display` is synchronous in the Obsidian API; the returned promise is for callers (and tests) that want to wait.
  (tab as any).display = function display(this: PluginSettingTab): Promise<void> {
    return render(this);
  };

  async function render(t: PluginSettingTab): Promise<void> {
    const mine = ++token;
    const { containerEl } = t;
    containerEl.empty();
    new Setting(containerEl).setName('Data').setDesc('Which connectors serve each data contract, in the order they are asked.').setHeading();
    let status: DataStatusView;
    try {
      status = await deps.data.status();
    } catch (e) {
      if (mine === token) new Setting(containerEl).setName(`Could not load data settings: ${(e as Error).message}`);
      return;
    }
    if (mine !== token) return;
    // Setting specs for vault connectors come from their manifest; fetched only for connectors that are bound somewhere.
    const vault = new Set(status.connectors.filter((c) => c.kind === 'vault').map((c) => c.id));
    const bound = new Set(status.contracts.flatMap((c) => c.sources.map((s) => s.id)));
    const specs = new Map<string, Record<string, SettingSpec>>();
    await Promise.all([...bound].filter((id) => vault.has(id)).map(async (id) => {
      try { const r = await deps.data.review(id); if (r.manifest) specs.set(id, r.manifest.settings); } catch { /* shown without settings */ }
    }));
    if (mine !== token) return;

    let file: DataFile = status.data;
    const save = async (next: DataFile, rerender: boolean) => {
      file = next;
      try { await deps.data.save(next); } catch (e) { new Notice(`Could not save: ${(e as Error).message}`); }
      if (rerender) await render(t);
    };
    const bindingsOf = (contract: string) => file.bindings[contract] ?? [];

    if (!status.contracts.length) new Setting(containerEl).setName('No data contracts yet.').setDesc('A vault template can ship contracts; none is installed.');
    for (const c of status.contracts) {
      new Setting(containerEl).setName(c.name).setDesc(c.error ?? (c.actions.length ? `Actions: ${c.actions.join(', ')}` : '')).setHeading();
      c.sources.forEach((s, i) => {
        const row = new Setting(containerEl).setName(s.id).setDesc(BADGE[s.status] ?? s.status);
        const move = (by: number) => {
          const ids = [...bindingsOf(c.name)];
          [ids[i], ids[i + by]] = [ids[i + by], ids[i]];
          return save({ ...file, bindings: { ...file.bindings, [c.name]: ids } }, true);
        };
        if (i > 0) row.addButton((b) => b.setButtonText('Move up').onClick(() => move(-1)));
        if (i < c.sources.length - 1) row.addButton((b) => b.setButtonText('Move down').onClick(() => move(1)));
        row.addButton((b) => b.setButtonText('Remove').setWarning().onClick(() => save({ ...file, bindings: { ...file.bindings, [c.name]: bindingsOf(c.name).filter((x) => x !== s.id) } }, true)));
        if (vault.has(s.id)) row.addButton((b) => b.setButtonText('Review').onClick(() => deps.openReview(s.id)));
        for (const [key, spec] of Object.entries(specs.get(s.id) ?? {})) renderSetting(containerEl, s.id, key, spec);
      });
      // DataStatus doesn't say which connectors provide which contract, so every connector not yet bound is offered.
      const candidates = status.connectors.filter((x) => !bindingsOf(c.name).includes(x.id));
      if (candidates.length) {
        let pick = candidates[0].id;
        new Setting(containerEl).setName('Add a connector').addDropdown((d) => {
          for (const x of candidates) d.addOption(x.id, x.kind === 'vault' ? `${x.id} (vault)` : x.id);
          d.setValue(pick).onChange((v) => { pick = v; });
        }).addButton((b) => b.setButtonText('Add').setCta().onClick(() => save({ ...file, bindings: { ...file.bindings, [c.name]: [...bindingsOf(c.name), pick] } }, true)));
      }
    }

    function renderSetting(el: HTMLElement, id: string, key: string, spec: SettingSpec): void {
      const current = (): SettingValue => file.settings[id]?.[key] ?? spec.default;
      const set = (v: SettingValue) => save({ ...file, settings: { ...file.settings, [id]: { ...file.settings[id], [key]: v } } }, false);
      const row = new Setting(el).setName(`${id} · ${spec.label}`);
      if (typeof spec.default === 'boolean') row.addToggle((x) => x.setValue(current() === true).onChange((v) => void set(v)));
      else row.addText((x) => x.setValue(String(current())).onChange((v) => {
        if (typeof spec.default === 'number') { const n = Number(v); if (v.trim() !== '' && Number.isFinite(n)) void set(n); } else void set(v);
      }));
    }
  }
  return tab;
}
