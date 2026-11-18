import { describe, expect, it, vi } from 'vitest';
import { App, Plugin, Setting } from './fake-obsidian';
import { createDataSettingTab, type DataClient, type DataStatusView } from '../src/ui';
import type { DataFile } from '../src/data';

const make = (over: Partial<DataStatusView> = {}) => {
  const saved: DataFile[] = [];
  const reviewed: string[] = [];
  const status: DataStatusView = {
    contracts: [{ name: 'download-queue', actions: ['pause'], sources: [{ id: 'sabnzbd', status: 'ready' }, { id: 'qbittorrent', status: 'waiting-review' }] }],
    connectors: [
      { id: 'sabnzbd', kind: 'built-in', state: 'built-in', provides: ['download-queue'], settings: { SABNZBD_URL: { default: 'http://localhost:8080', label: 'SABnzbd URL' } } },
      { id: 'radarr', kind: 'built-in', state: 'built-in', provides: ['movies'], settings: {} },
      { id: 'transmission', kind: 'built-in', state: 'built-in', provides: ['download-queue'], settings: {} },
      { id: 'qbittorrent', kind: 'vault', state: 'new', provides: ['download-queue'], settings: { baseUrl: { default: 'http://localhost:8080', label: 'Base URL' } } },
    ],
    data: { bindings: { 'download-queue': ['sabnzbd', 'qbittorrent'] }, settings: {} },
    ...over,
  };
  const data: DataClient = {
    status: async () => status,
    save: async (f) => { saved.push(f); },
  };
  const tab: any = createDataSettingTab({ app: new App() as any, plugin: new Plugin() as any, data, openReview: (id) => void reviewed.push(id) });
  return { tab, saved, reviewed, rows: () => tab.containerEl.settings as Setting[] };
};

describe('Settings → Data tab', () => {
  it('is a tab named Data that shows each contract with its sources and status badges', async () => {
    const { tab, rows } = make();
    await tab.display();
    expect([tab.id, tab.name]).toEqual(['data', 'Data sources']);
    expect(rows().find((r) => r.name === 'download-queue')!.heading).toBe(true);
    expect(rows().find((r) => r.name === 'sabnzbd')!.desc).toBe('ready');
    expect(rows().find((r) => r.name === 'qbittorrent')!.desc).toBe('waiting for review');
  });

  it('is titled Data sources, with the vault-scoped description', async () => {
    const { tab, rows } = make();
    await tab.display();
    expect(tab.name).toBe('Data sources');
    const h = rows().find((r) => r.heading && r.name === 'Data sources')!;
    expect(h.desc).toBe("Which connector answers each kind of data this vault's notes ask for (calendar events, mail, …), in order.");
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
    expect(add.dropdowns[0].options).toEqual(['transmission']);
    add.dropdowns[0].change('transmission');
    add.buttons[0].click();
    await new Promise((r) => setTimeout(r, 0));
    expect(saved[1].bindings['download-queue']).toEqual(['sabnzbd', 'qbittorrent', 'transmission']);
  });

  it('Review is offered for vault connectors only and opens the review tab', async () => {
    const { tab, reviewed, rows } = make();
    await tab.display();
    expect(rows().find((r) => r.name === 'sabnzbd')!.buttons.map((b) => b.text)).not.toContain('Review');
    const q = rows().find((r) => r.name === 'qbittorrent')!;
    q.buttons.find((b) => b.text === 'Review')!.click();
    expect(reviewed).toEqual(['qbittorrent']);
  });

  it('shows settings for built-in and vault connectors; a burst of edits saves once, after the debounce', async () => {
    vi.useFakeTimers();
    try {
      const { tab, saved, rows } = make();
      await tab.display();
      const sab = rows().find((r) => r.name === 'sabnzbd · SABnzbd URL')!;
      expect(sab.texts[0].value).toBe('http://localhost:8080');
      expect(rows().find((r) => r.name === 'qbittorrent · Base URL')).toBeDefined();
      sab.texts[0].change('http://n');
      sab.texts[0].change('http://nas:8080');
      expect(saved).toEqual([]);
      await vi.advanceTimersByTimeAsync(450);
      expect(saved).toEqual([{ bindings: { 'download-queue': ['sabnzbd', 'qbittorrent'] }, settings: { sabnzbd: { SABNZBD_URL: 'http://nas:8080' } } }]);
    } finally { vi.useRealTimers(); }
  });

  it('clearing a text or number setting removes the key so the default applies', async () => {
    vi.useFakeTimers();
    try {
      const { tab, saved, rows } = make({
        connectors: [
          { id: 'sabnzbd', kind: 'built-in', state: 'built-in', provides: ['download-queue'], settings: { SABNZBD_URL: { default: 'http://localhost:8080', label: 'SABnzbd URL' } } },
          { id: 'qbittorrent', kind: 'vault', state: 'new', provides: ['download-queue'], settings: { limit: { default: 10, label: 'Limit' } } },
        ],
        data: { bindings: { 'download-queue': ['sabnzbd', 'qbittorrent'] }, settings: { sabnzbd: { SABNZBD_URL: 'http://nas:8080' }, qbittorrent: { limit: 5 } } },
      });
      await tab.display();
      rows().find((r) => r.name === 'sabnzbd · SABnzbd URL')!.texts[0].change('');
      rows().find((r) => r.name === 'qbittorrent · Limit')!.texts[0].change('  ');
      await vi.advanceTimersByTimeAsync(450);
      expect(saved.at(-1)!.settings).toEqual({ sabnzbd: {}, qbittorrent: {} });
    } finally { vi.useRealTimers(); }
  });
});
