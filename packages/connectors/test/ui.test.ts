import { describe, expect, it } from 'vitest';
import { App, Plugin, Setting, notices } from './fake-obsidian';
import { createSecretsSettingTab } from '../src/ui';
import { appScope, connectorScope, createConnectorHost, createFakeSafeStorage, createSecretStore, type SecretEntry } from '../src/main';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const make = async () => {
  const secrets = createSecretStore({ userDataDir: mkdtempSync(join(tmpdir(), 'ui-')), safeStorage: createFakeSafeStorage() });
  await secrets.ready;
  const host = createConnectorHost({ secrets });
  const apps = [{ id: 'downloadrr', name: 'Downloadrr', connectors: ['radarr', 'google-calendar'], secrets: [{ name: 'EXTRA_KEY', label: 'Extra', required: true }] }];
  const tab: any = createSecretsSettingTab({ app: new App() as any, plugin: new Plugin() as any, secrets, entries: () => host.entries(apps) });
  tab.display();
  return { secrets, tab, rows: () => tab.containerEl.settings as Setting[] };
};

describe('Settings → Secrets tab', () => {
  it('is a tab named Secrets that lists names per app and connector, never values', async () => {
    const { tab, rows } = await make();
    expect([tab.id, tab.name]).toEqual(['secrets', 'Secrets']);
    const names = rows().map((r) => r.name);
    expect(names).toContain('Downloadrr');
    expect(names).toContain('Radarr');
    expect(rows().find((r) => r.name === 'Extra')!.desc).toBe('EXTRA_KEY · required · not set');
    expect(rows().find((r) => r.name === 'Extra')!.texts[0].inputEl.type).toBe('password');
  });
  it('Save writes to the keychain, marks set, offers Remove; Remove deletes', async () => {
    const { secrets, tab, rows } = await make();
    const row = () => rows().find((r) => r.name === 'Extra')!;
    row().texts[0].change('s3cret');
    row().buttons[0].click();
    expect(secrets.get(appScope('downloadrr'), 'EXTRA_KEY')).toBe('s3cret');
    expect(row().desc).toContain('· set');
    expect(row().buttons.map((b) => b.text)).toEqual(['Replace', 'Remove']);
    expect(JSON.stringify(rows().map((r) => r.desc))).not.toContain('s3cret');
    row().buttons[1].click();
    expect(secrets.has(appScope('downloadrr'), 'EXTRA_KEY')).toBe(false);
    void tab;
  });
  it('an empty Save is refused with a notice; OAuth tokens are not typeable', async () => {
    notices.length = 0;
    const { rows } = await make();
    rows().find((r) => r.name === 'Extra')!.buttons[0].click();
    expect(notices).toContain('Enter a value first.');
    expect(rows().find((r) => r.name === 'Google access token (managed)')!.texts).toHaveLength(0);
  });
  it('no longer ends with a fixed Google Calendar pointer', async () => {
    const { rows } = await make();
    expect(rows().some((r) => r.name === 'Google Calendar' && !r.heading)).toBe(false);
  });
});

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const homeRows = (): SecretEntry[] => [
  { scope: 'connector:radarr', owner: 'Radarr', name: 'RADARR_API_KEY', label: 'Radarr API key', required: true, isSet: true, managed: false, class: 'shared', policy: 'all' },
  { scope: 'harness:chat', owner: 'Chat providers', name: 'ANTHROPIC_API_KEY', label: 'ANTHROPIC_API_KEY', required: false, isSet: true, managed: false, class: 'shared', policy: { only: [A] } },
  { scope: 'provider:google', owner: 'Google OAuth client', name: 'GOOGLE_CLIENT_ID', label: 'Client ID', required: false, isSet: false, managed: false, class: 'home' },
];
const makeHome = () => {
  const writes: [string, unknown][] = [];
  const store = new Map<string, string>();
  const secrets = { has: (s: string, n: string) => store.has(`${s}/${n}`), get: () => null, set: (s: string, n: string, v: string) => void store.set(`${s}/${n}`, v), delete: (s: string, n: string) => void store.delete(`${s}/${n}`) };
  let rows = homeRows();
  const tab: any = createSecretsSettingTab({
    app: new App() as any, plugin: new Plugin() as any, secrets, isHome: true, entries: () => rows,
    policy: {
      vaults: () => [{ uuid: A, name: 'Alpha' }, { uuid: B, name: 'Beta' }],
      set: (key, p) => {
        writes.push([key, p]);
        rows = rows.map((r) => (`${r.scope}/${r.name}` === key ? { ...r, policy: p ?? 'all' } : r));
      },
    },
  });
  tab.display();
  return { tab, writes, store, rows: () => tab.containerEl.settings as Setting[] };
};

describe('Settings → Secrets in Home', () => {
  it('each secret row shows its owner, set state and a Vaults policy dropdown with the policy labels', () => {
    const { rows } = makeHome();
    const r = rows().find((x) => x.name === 'Radarr API key')!;
    expect(r.desc).toContain('RADARR_API_KEY');
    expect(r.desc).toContain('Radarr');
    expect(r.desc).toContain('set');
    expect(r.dropdowns).toHaveLength(1);
    expect(r.dropdowns[0].labels).toEqual(['Allow all', 'Only these vaults', 'All except these vaults', 'Not available in vaults']);
    expect(r.dropdowns[0].value).toBe('all');
    expect(r.buttons.map((b) => b.text)).toEqual(['Replace', 'Remove']);
  });
  it('a Home-only secret shows "Home only" in place of the dropdown and stays typeable', () => {
    const { rows, store } = makeHome();
    const g = rows().find((x) => x.name === 'Client ID')!;
    expect(g.dropdowns).toHaveLength(0);
    expect(g.controlEl.spans).toContain('Home only');
    g.texts[0].change('id-1');
    g.buttons[0].click();
    expect(store.get('provider:google/GOOGLE_CLIENT_ID')).toBe('id-1');
  });
  it('changing the dropdown writes the policy; a vault list shows one toggle per vault', () => {
    const { rows, writes } = makeHome();
    rows().find((x) => x.name === 'Radarr API key')!.dropdowns[0].change('none');
    expect(writes.pop()).toEqual(['connector:radarr/RADARR_API_KEY', 'none']);
    const key = rows().find((x) => x.name === 'ANTHROPIC_API_KEY' && x.dropdowns.length)!;
    expect(key.dropdowns[0].value).toBe('only');
    const alpha = rows().find((x) => x.name === 'Alpha')!;
    const beta = rows().find((x) => x.name === 'Beta')!;
    expect([alpha.toggles[0].value, beta.toggles[0].value]).toEqual([true, false]);
    beta.toggles[0].change(true);
    expect(writes.pop()).toEqual(['harness:chat/ANTHROPIC_API_KEY', { only: [A, B] }]);
  });
});

describe('Settings → Secrets in a vault', () => {
  it('shows a read-only From Home section and an editable This vault section', () => {
    const rowsIn: SecretEntry[] = [
      { scope: 'aaaa1111/downloadrr', owner: 'Downloadrr', name: 'EXTRA', label: 'Extra', required: true, isSet: false, managed: false, class: 'vault' },
      { scope: 'connector:radarr', owner: 'Radarr', name: 'RADARR_API_KEY', label: 'Radarr API key', required: true, isSet: true, managed: false, class: 'shared' },
    ];
    const secrets = { has: () => false, get: () => null, set: () => {}, delete: () => {} };
    const tab: any = createSecretsSettingTab({ app: new App() as any, plugin: new Plugin() as any, secrets, isHome: false, entries: () => rowsIn });
    tab.display();
    const rows = tab.containerEl.settings as Setting[];
    const headings = rows.filter((r) => r.heading).map((r) => r.name);
    expect(headings.indexOf('From Home')).toBeGreaterThan(-1);
    expect(headings.indexOf('This vault')).toBeGreaterThan(headings.indexOf('From Home'));
    const shared = rows.find((r) => r.name === 'Radarr API key')!;
    expect(shared.desc).toContain('set');
    expect([shared.texts.length, shared.buttons.length, shared.dropdowns.length]).toEqual([0, 0, 0]);
    const own = rows.find((r) => r.name === 'Extra')!;
    expect(own.texts).toHaveLength(1);
    expect(own.buttons.map((b) => b.text)).toEqual(['Save']);
  });
});
