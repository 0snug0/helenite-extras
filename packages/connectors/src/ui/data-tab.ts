// Settings → Data: each reference contract, the connectors bound to it (in order, with status badges), add / remove /
// move up / move down, per-connector settings, and a Review button for vault connectors. Written against a structural
// `DataClient` (matching `window.helenite.data`) so this package never imports desktop code. Every name, id and message
// shown here is vault-controlled, so it only ever goes through `setName` / `setDesc` (text), never HTML.
import { PluginSettingTab, Setting, type App, type Plugin } from 'obsidian';
import { ui } from 'helenite';
import type { ContractStatus, DataFile } from '../data';
import type { SettingSpec, SettingValue } from '../sdk';

export interface DataStatusView {
  contracts: ContractStatus[];
  connectors: { id: string; kind: 'built-in' | 'vault'; state: string; error?: string; provides: string[]; settings: Record<string, SettingSpec> }[];
  data: DataFile;
}

export interface DataClient {
  status(): Promise<DataStatusView>;
  save(f: DataFile): Promise<void>;
}

export interface DataTabDeps {
  app: App;
  plugin: Plugin;
  data: DataClient;
  openReview(id: string): void;
}

const SAVE_DEBOUNCE_MS = 400;
const BADGE: Record<string, string> = { ready: 'ready', 'waiting-review': 'waiting for review', rejected: 'rejected', missing: 'missing' };

export function createDataSettingTab(deps: DataTabDeps): PluginSettingTab {
  const tab: PluginSettingTab = new (class extends PluginSettingTab { display(): void {} })(deps.app, deps.plugin);
  tab.id = 'data';
  tab.name = 'Data sources';
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
    new Setting(containerEl).setName('Data sources').setDesc("Which connector answers each kind of data this vault's notes ask for (calendar events, mail, …), in order.").setHeading();
    let status: DataStatusView;
    try {
      status = await deps.data.status();
    } catch (e) {
      if (mine === token) ui.errorState(containerEl, `Could not load data settings: ${(e as Error).message}`, undefined, { variant: 'inline' });
      return;
    }
    if (mine !== token) return;
    const byId = new Map(status.connectors.map((x) => [x.id, x]));
    const vault = new Set(status.connectors.filter((x) => x.kind === 'vault').map((x) => x.id));

    let file: DataFile = status.data;
    const write = async (next: DataFile) => {
      try { await deps.data.save(next); } catch (e) { ui.notice(`Could not save: ${(e as Error).message}`, { kind: 'error' }); }
    };
    const save = async (next: DataFile, rerender: boolean) => {
      file = next;
      await write(next);
      if (rerender) await render(t);
    };
    // Typing saves after a pause, not on every keystroke.
    let timer: ReturnType<typeof setTimeout> | undefined;
    const saveSoon = (next: DataFile) => {
      file = next;
      clearTimeout(timer);
      timer = setTimeout(() => void write(file), SAVE_DEBOUNCE_MS);
    };
    const bindingsOf = (contract: string) => file.bindings[contract] ?? [];

    if (!status.contracts.length) new Setting(containerEl).setName('No data contracts yet.').setDesc('A vault template can ship contracts; none is installed.');
    for (const c of status.contracts) {
      new Setting(containerEl).setName(c.name).setDesc(c.error ?? (c.actions.length ? `Actions: ${c.actions.join(', ')}` : '')).setHeading();
      c.sources.forEach((s, i) => {
        const row = new Setting(containerEl).setName(s.id).setDesc(BADGE[s.status] ?? s.status);
        row.settingEl.dataset.source = `${c.name}/${s.id}`;
        const move = (by: number) => {
          const ids = [...bindingsOf(c.name)];
          [ids[i], ids[i + by]] = [ids[i + by], ids[i]];
          return save({ ...file, bindings: { ...file.bindings, [c.name]: ids } }, true);
        };
        const at = row.controlEl;
        if (i > 0) ui.action(at, 'moveUp', { onClick: () => move(-1) });
        if (i < c.sources.length - 1) ui.action(at, 'moveDown', { onClick: () => move(1) });
        ui.action(at, 'remove', {
          app: deps.app,
          subject: s.id,
          message: `Remove ${s.id} from ${c.name}?`,
          onClick: () => save({ ...file, bindings: { ...file.bindings, [c.name]: bindingsOf(c.name).filter((x) => x !== s.id) } }, true),
        });
        if (vault.has(s.id)) ui.action(at, 'open', { label: 'Review', onClick: () => deps.openReview(s.id) });
        for (const [key, spec] of Object.entries(byId.get(s.id)?.settings ?? {})) renderSetting(containerEl, s.id, key, spec);
      });
      const candidates = status.connectors.filter((x) => x.provides.includes(c.name) && !bindingsOf(c.name).includes(x.id));
      if (candidates.length) {
        let pick = candidates[0].id;
        const add = new Setting(containerEl).setName('Add a connector').addDropdown((d) => {
          for (const x of candidates) d.addOption(x.id, x.kind === 'vault' ? `${x.id} (vault)` : x.id);
          d.setValue(pick).onChange((v) => { pick = v; });
        });
        add.settingEl.dataset.add = c.name;
        ui.button(add.controlEl, { text: 'Add', variant: 'primary', onClick: () => save({ ...file, bindings: { ...file.bindings, [c.name]: [...bindingsOf(c.name), pick] } }, true) });
      }
    }

    function renderSetting(el: HTMLElement, id: string, key: string, spec: SettingSpec): void {
      const current = (): SettingValue => file.settings[id]?.[key] ?? spec.default;
      const set = (v: SettingValue) => saveSoon({ ...file, settings: { ...file.settings, [id]: { ...file.settings[id], [key]: v } } });
      // A cleared field drops the key, so the default applies again.
      const unset = () => {
        const { [key]: _gone, ...rest } = file.settings[id] ?? {};
        saveSoon({ ...file, settings: { ...file.settings, [id]: rest } });
      };
      const row = new Setting(el).setName(`${id} · ${spec.label}`);
      row.settingEl.dataset.setting = `${id}/${key}`;
      if (typeof spec.default === 'boolean') row.addToggle((x) => x.setValue(current() === true).onChange((v) => set(v)));
      else row.addText((x) => x.setPlaceholder(String(spec.default)).setValue(String(current())).onChange((v) => {
        if (v.trim() === '') return unset();
        if (typeof spec.default === 'number') { const n = Number(v); if (Number.isFinite(n)) set(n); } else set(v);
      }));
    }
  }
  return tab;
}
