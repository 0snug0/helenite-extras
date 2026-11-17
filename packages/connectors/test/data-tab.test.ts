import { describe, expect, it } from 'vitest';
import { App, Plugin, Setting } from './fake-obsidian';
import { createDataSettingTab, type DataClient, type DataStatusView } from '../src/ui';
import type { DataFile } from '../src/data';

const make = (over: Partial<DataStatusView> = {}) => {
  const saved: DataFile[] = [];
  const reviewed: string[] = [];
  const status: DataStatusView = {
    contracts: [{ name: 'download-queue', actions: ['pause'], sources: [{ id: 'sabnzbd', status: 'ready' }, { id: 'qbittorrent', status: 'waiting-review' }] }],
    connectors: [{ id: 'sabnzbd', kind: 'built-in', state: 'built-in' }, { id: 'radarr', kind: 'built-in', state: 'built-in' }, { id: 'qbittorrent', kind: 'vault', state: 'new' }],
    data: { bindings: { 'download-queue': ['sabnzbd', 'qbittorrent'] }, settings: {} },
    ...over,
  };
  const data: DataClient = {
    status: async () => status,
    review: async () => ({ manifest: { settings: { baseUrl: { default: 'http://localhost:8080', label: 'Base URL' } } } }),
    save: async (f) => { saved.push(f); },
  };
  const tab: any = createDataSettingTab({ app: new App() as any, plugin: new Plugin() as any, data, openReview: (id) => void reviewed.push(id) });
  return { tab, saved, reviewed, rows: () => tab.containerEl.settings as Setting[] };
};

describe('Settings → Data tab', () => {
  it('is a tab named Data that shows each contract with its sources and status badges', async () => {
    const { tab, rows } = make();
    await tab.display();
    expect([tab.id, tab.name]).toEqual(['data', 'Data']);
    expect(rows().find((r) => r.name === 'download-queue')!.heading).toBe(true);
    expect(rows().find((r) => r.name === 'sabnzbd')!.desc).toBe('ready');
    expect(rows().find((r) => r.name === 'qbittorrent')!.desc).toBe('waiting for review');
  });

  it('moving a source down saves swapped bindings', async () => {
    const { tab, saved, rows } = make();
    await tab.display();
    const row = rows().find((r) => r.name === 'sabnzbd')!;
    expect(row.buttons.map((b) => b.text)).toEqual(['Move down', 'Remove']);
    row.buttons[0].click();
    await new Promise((r) => setTimeout(r, 0));
    expect(saved).toEqual([{ bindings: { 'download-queue': ['qbittorrent', 'sabnzbd'] }, settings: {} }]);
  });

  it('Remove drops the binding; Add appends the chosen connector (bound ones are not offered)', async () => {
    const { tab, saved, rows } = make();
    await tab.display();
    rows().find((r) => r.name === 'sabnzbd')!.buttons.find((b) => b.text === 'Remove')!.click();
    await new Promise((r) => setTimeout(r, 0));
    expect(saved[0].bindings['download-queue']).toEqual(['qbittorrent']);
    const add = rows().find((r) => r.name === 'Add a connector')!;
    expect(add.dropdowns[0].options).toEqual(['radarr']);
    add.dropdowns[0].change('radarr');
    add.buttons[0].click();
    await new Promise((r) => setTimeout(r, 0));
    expect(saved[1].bindings['download-queue']).toEqual(['sabnzbd', 'qbittorrent', 'radarr']);
  });

  it('Review is offered for vault connectors only and opens the review tab', async () => {
    const { tab, reviewed, rows } = make();
    await tab.display();
    expect(rows().find((r) => r.name === 'sabnzbd')!.buttons.map((b) => b.text)).not.toContain('Review');
    const q = rows().find((r) => r.name === 'qbittorrent')!;
    q.buttons.find((b) => b.text === 'Review')!.click();
    expect(reviewed).toEqual(['qbittorrent']);
  });

  it('shows the vault connector manifest settings and saves an edit', async () => {
    const { tab, saved, rows } = make();
    await tab.display();
    const s = rows().find((r) => r.name === 'qbittorrent · Base URL')!;
    expect(s.texts[0].value).toBe('http://localhost:8080');
    s.texts[0].change('http://nas:8080');
    await new Promise((r) => setTimeout(r, 0));
    expect(saved[0].settings).toEqual({ qbittorrent: { baseUrl: 'http://nas:8080' } });
  });
});
