import { describe, expect, it, vi } from 'vitest';
// The sample's tests run without a DOM, so the settings tab base class and Notice are stand-ins.
const notices = vi.hoisted(() => [] as string[]);
vi.mock('obsidian', async (orig) => ({
  ...(await orig<object>()),
  PluginSettingTab: class { constructor(public app: unknown, public plugin: unknown) {} },
  Notice: class { constructor(msg: string) { notices.push(msg); } },
}));

import LetterboxdVaultPlugin, { diaryMarkdown } from '../src/main';
import LetterboxdAccountsEntry, { letterboxd } from '../src/accounts';

const entry = (over: object = {}) => ({ title: 'Heat', year: 1995, rating: 4.5, watchedDate: '2026-01-02', rewatch: false, link: 'https://letterboxd.com/me/film/heat/', ...over });
const manifest = { id: 'letterboxd-account', name: 'L', version: '1', minAppVersion: '1', description: '', author: '' } as any;

function fakeApp(call: (o: any) => Promise<unknown>) {
  const commands: any[] = [];
  const tabs: any[] = [];
  const app: any = { accounts: { call: vi.fn(call) }, commands: { addCommand: (c: any) => commands.push(c) }, setting: { addSettingTab: (t: any) => tabs.push(t) } };
  return { app, commands, tabs };
}

describe('diaryMarkdown', () => {
  it('renders a list item per entry', () => {
    expect(diaryMarkdown([entry(), entry({ title: 'Alien', year: null, rating: null, watchedDate: null, rewatch: true, link: 'x' })])).toBe(
      '- [Heat (1995)](https://letterboxd.com/me/film/heat/) ★ 4.5 · 2026-01-02\n- [Alien](x) · rewatch\n',
    );
    expect(diaryMarkdown([])).toBe('');
  });
});

describe('main entry (vault feature)', () => {
  async function load(call: (o: any) => Promise<unknown>, data: object | null) {
    const f = fakeApp(call);
    const plugin = new LetterboxdVaultPlugin(f.app, manifest);
    plugin.loadData = async () => data;
    plugin.saveData = vi.fn(async () => {});
    await plugin.onload();
    return { ...f, plugin };
  }
  it('registers the command and a settings tab, and registers no account type', async () => {
    const { commands, tabs, app } = await load(async () => [], null);
    expect(commands.map((c) => c.id)).toEqual(['letterboxd-account:insert-latest-diary']);
    expect(tabs).toHaveLength(1);
    expect(app.accounts.registerAccountType).toBeUndefined();
  });
  it('calls the diary method of the configured account and inserts a list at the cursor', async () => {
    const { commands, app } = await load(async () => [entry()], { accountLabel: 'Letterboxd (me)' });
    const editor = { replaceSelection: vi.fn() };
    commands[0].editorCallback(editor);
    await vi.waitFor(() => expect(editor.replaceSelection).toHaveBeenCalled());
    expect(app.accounts.call).toHaveBeenCalledWith({ account: 'Letterboxd (me)', method: 'diary', args: { limit: 5 } });
    expect(editor.replaceSelection).toHaveBeenCalledWith('- [Heat (1995)](https://letterboxd.com/me/film/heat/) ★ 4.5 · 2026-01-02\n');
  });
  it('does not call out without an account label, and inserts nothing when the call is refused', async () => {
    const none = await load(async () => [], null);
    const e1 = { replaceSelection: vi.fn() };
    await none.plugin.insertDiary(e1 as any);
    expect(none.app.accounts.call).not.toHaveBeenCalled();
    expect(e1.replaceSelection).not.toHaveBeenCalled();
    expect(notices.at(-1)).toContain('account label');
    const refused = await load(async () => { throw new Error('not granted'); }, { accountLabel: 'x' });
    const e2 = { replaceSelection: vi.fn() };
    await refused.plugin.insertDiary(e2 as any);
    expect(e2.replaceSelection).not.toHaveBeenCalled();
    expect(notices.at(-1)).toContain('not granted');
  });
});

describe('accounts entry', () => {
  it('registers only the account type, with no commands or settings', () => {
    const registerAccountType = vi.fn();
    const commands: any[] = [];
    const app: any = { accounts: {}, commands: { addCommand: (c: any) => commands.push(c) }, setting: { addSettingTab: vi.fn() } };
    const plugin = new LetterboxdAccountsEntry(app, { ...manifest, id: 'letterboxd-account#accounts' });
    plugin.registerAccountType = registerAccountType;
    plugin.onload();
    expect(registerAccountType).toHaveBeenCalledWith(letterboxd);
    expect(commands).toEqual([]);
    expect(app.setting.addSettingTab).not.toHaveBeenCalled();
  });
});
