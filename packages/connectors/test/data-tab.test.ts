// @vitest-environment jsdom
import './ui-setup';
import { describe, expect, it, vi } from 'vitest';
import { makeApp, tick } from '../../../plugins/core-build/test/harness';
import { createDataSettingTab, type DataClient, type DataStatusView } from '../src/ui';
import type { DataFile } from '../src/data';

const make = async (over: Partial<DataStatusView> = {}) => {
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
  const { app } = await makeApp();
  const tab: any = createDataSettingTab({ app: app as any, plugin: { app, manifest: { id: 'helenite' } } as any, data, openReview: (id) => void reviewed.push(id) });
  document.body.append(tab.containerEl);
  return { tab, saved, reviewed };
};

const row = (name: string) => Array.from(document.querySelectorAll<HTMLElement>('.setting-item')).find((r) => r.querySelector('.setting-item-name')?.textContent === name)!;
const source = (id: string) => document.querySelector<HTMLElement>(`[data-source="download-queue/${id}"]`)!;
/** A row's buttons by accessible name (an icon button's label) or text. */
const names = (r: HTMLElement) => Array.from(r.querySelectorAll<HTMLButtonElement>('.setting-item-control button')).map((b) => b.getAttribute('aria-label') ?? b.textContent);
const button = (r: HTMLElement, name: string) => Array.from(r.querySelectorAll<HTMLButtonElement>('button')).find((b) => (b.getAttribute('aria-label') ?? b.textContent) === name)!;
const type = (i: HTMLInputElement, v: string) => { i.value = v; i.dispatchEvent(new Event('input', { bubbles: true })); };

describe('Settings → Data tab', () => {
  it('is a tab named Data that shows each contract with its sources and status badges', async () => {
    const { tab } = await make();
    await tab.display();
    expect([tab.id, tab.name]).toEqual(['data', 'Data sources']);
    expect(row('download-queue').classList.contains('setting-item-heading')).toBe(true);
    expect(source('sabnzbd').querySelector('.setting-item-description')!.textContent).toBe('ready');
    expect(source('qbittorrent').querySelector('.setting-item-description')!.textContent).toBe('waiting for review');
  });

  it('is titled Data sources, with the vault-scoped description', async () => {
    const { tab } = await make();
    await tab.display();
    expect(tab.name).toBe('Data sources');
    expect(row('Data sources').querySelector('.setting-item-description')!.textContent).toBe("Which connector answers each kind of data this vault's notes ask for (calendar events, mail, …), in order.");
  });

  it('moving a source down saves swapped bindings', async () => {
    const { tab, saved } = await make();
    await tab.display();
    expect(names(source('sabnzbd'))).toEqual(['Move down', 'Remove']);
    expect(names(source('qbittorrent'))).toEqual(['Move up', 'Remove', 'Review']);
    button(source('sabnzbd'), 'Move down').click();
    await tick(0);
    expect(saved).toEqual([{ bindings: { 'download-queue': ['qbittorrent', 'sabnzbd'] }, settings: {} }]);
  });

  it('Remove asks first, then drops the binding; Add appends the chosen connector (bound ones are not offered)', async () => {
    const { tab, saved } = await make();
    await tab.display();
    button(source('sabnzbd'), 'Remove').click();
    await tick(5);
    expect(document.querySelector('.modal')!.textContent).toContain('Remove sabnzbd from download-queue?');
    Array.from(document.querySelectorAll<HTMLButtonElement>('.modal button')).find((b) => b.textContent === 'Remove')!.click();
    await tick(5);
    expect(saved[0].bindings['download-queue']).toEqual(['qbittorrent']);
    const add = document.querySelector<HTMLElement>('[data-add="download-queue"]')!;
    const select = add.querySelector('select')!;
    expect(Array.from(select.options).map((o) => o.value)).toEqual(['transmission']);
    select.value = 'transmission';
    select.dispatchEvent(new Event('change'));
    button(add, 'Add').click();
    await tick(5);
    expect(saved[1].bindings['download-queue']).toEqual(['sabnzbd', 'qbittorrent', 'transmission']);
  });

  it('Review is offered for vault connectors only and opens the review tab', async () => {
    const { tab, reviewed } = await make();
    await tab.display();
    expect(names(source('sabnzbd'))).not.toContain('Review');
    button(source('qbittorrent'), 'Review').click();
    expect(reviewed).toEqual(['qbittorrent']);
  });

  it('shows settings for built-in and vault connectors; a burst of edits saves once, after the debounce', async () => {
    const { tab, saved } = await make();
    await tab.display();
    vi.useFakeTimers();
    try {
      const sab = document.querySelector<HTMLElement>('[data-setting="sabnzbd/SABNZBD_URL"]')!.querySelector('input')!;
      expect(sab.value).toBe('http://localhost:8080');
      expect(document.querySelector('[data-setting="qbittorrent/baseUrl"]')).not.toBeNull();
      type(sab, 'http://n');
      type(sab, 'http://nas:8080');
      expect(saved).toEqual([]);
      await vi.advanceTimersByTimeAsync(450);
      expect(saved).toEqual([{ bindings: { 'download-queue': ['sabnzbd', 'qbittorrent'] }, settings: { sabnzbd: { SABNZBD_URL: 'http://nas:8080' } } }]);
    } finally { vi.useRealTimers(); }
  });

  it('clearing a text or number setting removes the key so the default applies', async () => {
    const { tab, saved } = await make({
      connectors: [
        { id: 'sabnzbd', kind: 'built-in', state: 'built-in', provides: ['download-queue'], settings: { SABNZBD_URL: { default: 'http://localhost:8080', label: 'SABnzbd URL' } } },
        { id: 'qbittorrent', kind: 'vault', state: 'new', provides: ['download-queue'], settings: { limit: { default: 10, label: 'Limit' } } },
      ],
      data: { bindings: { 'download-queue': ['sabnzbd', 'qbittorrent'] }, settings: { sabnzbd: { SABNZBD_URL: 'http://nas:8080' }, qbittorrent: { limit: 5 } } },
    });
    await tab.display();
    vi.useFakeTimers();
    try {
      type(document.querySelector<HTMLElement>('[data-setting="sabnzbd/SABNZBD_URL"]')!.querySelector('input')!, '');
      type(document.querySelector<HTMLElement>('[data-setting="qbittorrent/limit"]')!.querySelector('input')!, '  ');
      await vi.advanceTimersByTimeAsync(450);
      expect(saved.at(-1)!.settings).toEqual({ sabnzbd: {}, qbittorrent: {} });
    } finally { vi.useRealTimers(); }
  });

  it('says so inline when the status cannot be read', async () => {
    const { app } = await makeApp();
    const tab: any = createDataSettingTab({ app: app as any, plugin: { app, manifest: { id: 'helenite' } } as any, data: { status: async () => { throw new Error('offline'); }, save: async () => {} }, openReview: () => {} });
    document.body.append(tab.containerEl);
    await tab.display();
    expect(tab.containerEl.querySelector('[role=alert]')!.textContent).toBe('Could not load data settings: offline');
  });
});
