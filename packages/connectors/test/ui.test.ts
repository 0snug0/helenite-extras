import { describe, expect, it } from 'vitest';
import { App, Plugin, Setting, notices } from './fake-obsidian';
import { createSecretsSettingTab } from '../src/ui';
import { appScope, connectorScope, createConnectorHost, createFakeSafeStorage, createSecretStore } from '../src/main';
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
    expect(row().buttons.map((b) => b.text)).toEqual(['Save', 'Remove']);
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
  it('points Google Calendar at Settings → Accounts instead of offering a connect button', async () => {
    const { rows } = await make();
    const g = rows().find((r) => r.name === 'Google Calendar' && !r.heading)!;
    expect(g.buttons).toHaveLength(0);
    expect(g.desc).toContain('Manage in Settings → Accounts');
  });
});
