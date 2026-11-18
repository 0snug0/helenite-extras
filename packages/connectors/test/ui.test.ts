// @vitest-environment jsdom
import './ui-setup';
import { describe, expect, it } from 'vitest';
import { makeApp, tick } from '../../../plugins/core-build/test/harness';
import { createSecretsSettingTab } from '../src/ui';
import { appScope, createConnectorHost, createFakeSafeStorage, createSecretStore, type SecretEntry } from '../src/main';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** Draws the tab into the document (a checkbox only fires change there). */
async function show(deps: Omit<Parameters<typeof createSecretsSettingTab>[0], 'app' | 'plugin'>) {
  const { app } = await makeApp();
  const tab: any = createSecretsSettingTab({ app: app as any, plugin: { app, manifest: { id: 'helenite' } } as any, ...deps });
  document.body.append(tab.containerEl);
  tab.display();
  return tab;
}

const rows = (): HTMLElement[] => Array.from(document.querySelectorAll<HTMLElement>('.setting-item'));
const row = (name: string) => rows().find((r) => r.querySelector('.setting-item-name')?.textContent === name)!;
const desc = (r: HTMLElement) => r.querySelector('.setting-item-description')!.textContent;
const buttons = (r: HTMLElement) => Array.from(r.querySelectorAll<HTMLButtonElement>('.setting-item-control button')).map((b) => b.textContent);
const button = (r: HTMLElement, text: string) => Array.from(r.querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent === text)!;
const headings = () => Array.from(document.querySelectorAll('.setting-item-heading .setting-item-name')).map((h) => h.textContent);
const type = (i: HTMLInputElement, v: string) => { i.value = v; i.dispatchEvent(new Event('input', { bubbles: true })); };
const confirmModal = (text: string) => Array.from(document.querySelectorAll<HTMLButtonElement>('.modal button')).find((b) => b.textContent === text)!.click();
const notices = () => Array.from(document.querySelectorAll('.notice')).map((n) => n.textContent);

const make = async () => {
  const secrets = createSecretStore({ userDataDir: mkdtempSync(join(tmpdir(), 'ui-')), safeStorage: createFakeSafeStorage() });
  await secrets.ready;
  const host = createConnectorHost({ secrets });
  const apps = [{ id: 'downloadrr', name: 'Downloadrr', connectors: ['radarr', 'google-calendar'], secrets: [{ name: 'EXTRA_KEY', label: 'Extra', required: true }] }];
  const tab = await show({ secrets, entries: () => host.entries(apps) });
  return { secrets, tab };
};

describe('Settings → Secrets tab', () => {
  it('is a tab named Secrets that lists names per app and connector, never values', async () => {
    const { tab } = await make();
    expect([tab.id, tab.name]).toEqual(['secrets', 'Secrets']);
    expect(headings()).toContain('Downloadrr');
    expect(headings()).toContain('Radarr');
    expect(desc(row('Extra'))).toBe('EXTRA_KEY · required · not set');
    expect(row('Extra').querySelector('input')!.type).toBe('password');
  });

  it('Save writes to the keychain, marks set, offers Remove; Remove asks first, then deletes', async () => {
    const { secrets } = await make();
    type(row('Extra').querySelector('input')!, 's3cret');
    button(row('Extra'), 'Save').click();
    expect(secrets.get(appScope('downloadrr'), 'EXTRA_KEY')).toBe('s3cret');
    expect(desc(row('Extra'))).toContain('· set');
    expect(buttons(row('Extra'))).toEqual(['Replace', 'Remove']);
    expect(document.body.textContent).not.toContain('s3cret');
    expect(row('Extra').querySelector('input')!.value).toBe('');
    expect(notices().join(' ')).toContain('EXTRA_KEY saved to the keychain.');
    expect(notices().some((n) => n!.includes('s3cret'))).toBe(false);
    button(row('Extra'), 'Remove').click();
    await tick(5);
    expect(document.querySelector('.modal')!.textContent).toContain('Remove EXTRA_KEY from the keychain?');
    confirmModal('Remove');
    await tick(5);
    expect(secrets.has(appScope('downloadrr'), 'EXTRA_KEY')).toBe(false);
  });

  it('Enter in the value box saves too', async () => {
    const { secrets } = await make();
    const input = row('Extra').querySelector('input')!;
    type(input, 'k2');
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(secrets.get(appScope('downloadrr'), 'EXTRA_KEY')).toBe('k2');
  });

  it('an empty Save is refused with a notice; OAuth tokens are not typeable', async () => {
    await make();
    button(row('Extra'), 'Save').click();
    expect(notices()).toContain('Enter a value first.');
    expect(row('Google access token (managed)').querySelector('input')).toBeNull();
  });

  it('no longer ends with a fixed Google Calendar pointer', async () => {
    await make();
    expect(rows().some((r) => !r.classList.contains('setting-item-heading') && r.querySelector('.setting-item-name')?.textContent === 'Google Calendar')).toBe(false);
  });
});

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const homeRows = (): SecretEntry[] => [
  { scope: 'connector:radarr', owner: 'Radarr', name: 'RADARR_API_KEY', label: 'Radarr API key', required: true, isSet: true, managed: false, class: 'shared', policy: 'all' },
  { scope: 'harness:chat', owner: 'Chat providers', name: 'ANTHROPIC_API_KEY', label: 'ANTHROPIC_API_KEY', required: false, isSet: true, managed: false, class: 'shared', policy: { only: [A] } },
  { scope: 'provider:google', owner: 'Google OAuth client', name: 'GOOGLE_CLIENT_ID', label: 'Client ID', required: false, isSet: false, managed: false, class: 'home' },
];
const makeHome = async () => {
  const writes: [string, unknown][] = [];
  const store = new Map<string, string>();
  const secrets = { has: (s: string, n: string) => store.has(`${s}/${n}`), get: () => null, set: (s: string, n: string, v: string) => void store.set(`${s}/${n}`, v), delete: (s: string, n: string) => void store.delete(`${s}/${n}`) };
  let list = homeRows();
  await show({
    secrets, isHome: true, entries: () => list,
    policy: {
      vaults: () => [{ uuid: A, name: 'Alpha' }, { uuid: B, name: 'Beta' }],
      set: (key, p) => {
        writes.push([key, p]);
        list = list.map((r) => (`${r.scope}/${r.name}` === key ? { ...r, policy: p ?? 'all' } : r));
      },
    },
  });
  return { writes, store };
};
const access = (key: string) => document.querySelector<HTMLElement>(`[data-access="${key}"]`)!;
const pick = (s: HTMLSelectElement, v: string) => { s.value = v; s.dispatchEvent(new Event('change')); };

describe('Settings → Secrets in Home', () => {
  it('each secret row shows its owner and set state, then a Vaults row with the policy labels', async () => {
    await makeHome();
    const r = row('Radarr API key');
    expect(r.dataset.secret).toBe('connector:radarr/RADARR_API_KEY');
    expect(desc(r)).toBe('RADARR_API_KEY · Radarr · required · set');
    expect(buttons(r)).toEqual(['Replace', 'Remove']);
    const sel = access('connector:radarr/RADARR_API_KEY').querySelector('select')!;
    expect(Array.from(sel.options).map((o) => o.textContent)).toEqual(['Allow all', 'Only these vaults', 'All except these vaults', 'Not available in vaults']);
    expect(sel.value).toBe('all');
  });

  it('a Home-only secret shows "Home only" in place of a Vaults row and stays typeable', async () => {
    const { store } = await makeHome();
    const g = row('Client ID');
    expect(access('provider:google/GOOGLE_CLIENT_ID')).toBeNull();
    expect(g.querySelector('.setting-item-control')!.textContent).toContain('Home only');
    type(g.querySelector('input')!, 'id-1');
    button(g, 'Save').click();
    expect(store.get('provider:google/GOOGLE_CLIENT_ID')).toBe('id-1');
  });

  it('changing the dropdown writes the policy; a vault list shows a checkbox per vault', async () => {
    const { writes } = await makeHome();
    pick(access('connector:radarr/RADARR_API_KEY').querySelector('select')!, 'none');
    expect(writes.pop()).toEqual(['connector:radarr/RADARR_API_KEY', 'none']);
    const key = access('harness:chat/ANTHROPIC_API_KEY');
    expect(key.querySelector('select')!.value).toBe('only');
    const boxes = Array.from(key.querySelectorAll<HTMLInputElement>('input[type=checkbox]'));
    expect(boxes.map((b) => [b.closest('label')!.textContent, b.checked])).toEqual([['Alpha', true], ['Beta', false]]);
    boxes[1].click();
    expect(writes.pop()).toEqual(['harness:chat/ANTHROPIC_API_KEY', { only: [A, B] }]);
  });

  it('Allow all writes no policy entry (null resets it)', async () => {
    const { writes } = await makeHome();
    pick(access('harness:chat/ANTHROPIC_API_KEY').querySelector('select')!, 'all');
    expect(writes.pop()).toEqual(['harness:chat/ANTHROPIC_API_KEY', null]);
  });
});

describe('Settings → Secrets in Home with an unreadable policy file', () => {
  it('shows one warning saying so', async () => {
    const secrets = { has: () => false, get: () => null, set: () => {}, delete: () => {} };
    await show({ secrets, isHome: true, entries: homeRows, policy: { vaults: () => [], set: () => {}, unreadable: () => true } });
    const warnings = Array.from(document.querySelectorAll('[data-unreadable]'));
    expect(warnings.map((w) => w.textContent)).toEqual(["The vault access file can't be read. Change any secret's Vaults setting to rewrite it."]);
  });
});

describe('Settings → Secrets in a vault', () => {
  it('shows a read-only From Home section and an editable This vault section', async () => {
    const rowsIn: SecretEntry[] = [
      { scope: 'aaaa1111/downloadrr', owner: 'Downloadrr', name: 'EXTRA', label: 'Extra', required: true, isSet: false, managed: false, class: 'vault' },
      { scope: 'connector:radarr', owner: 'Radarr', name: 'RADARR_API_KEY', label: 'Radarr API key', required: true, isSet: true, managed: false, class: 'shared' },
    ];
    const secrets = { has: () => false, get: () => null, set: () => {}, delete: () => {} };
    await show({ secrets, isHome: false, entries: () => rowsIn });
    expect(headings().indexOf('From Home')).toBeGreaterThan(-1);
    expect(headings().indexOf('This vault')).toBeGreaterThan(headings().indexOf('From Home'));
    const shared = row('Radarr API key');
    expect(desc(shared)).toContain('set');
    expect(shared.querySelectorAll('input, button, select').length).toBe(0);
    const own = row('Extra');
    expect(own.querySelectorAll('input').length).toBe(1);
    expect(buttons(own)).toEqual(['Save']);
  });
});
