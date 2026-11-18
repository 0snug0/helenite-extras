// Loads the built plugin (`pnpm test` here builds it first) into a real Helenite App.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { loadBuiltPlugin, makeApp, tick } from '../../core-build/test/harness';

async function setup(settings: Record<string, unknown> = {}, files: Record<string, string> = { 'Home.md': '# Home', 'Other.md': 'other' }) {
  const { app, vaultPath } = await makeApp(files);
  const ws: any = app.workspace;
  expect(ws.layoutReady).toBe(false);
  await ws.getLeaf(false).openFile(app.vault.getFileByPath('Other.md') ?? app.vault.getMarkdownFiles()[0]);
  const plugin: any = await loadBuiltPlugin(app, 'helenite-homepage');
  expect(plugin).toBeTruthy();
  Object.assign(plugin.settings, settings);
  ws.triggerLayoutReady();
  await tick(30);
  const paths = () => {
    const out: (string | null)[] = [];
    ws.iterateRootLeaves((l: any) => void out.push(l.view?.file?.path ?? l.view?.getViewType()));
    return out;
  };
  return { app: app as any, ws, plugin, paths, vaultPath };
}

it('opens the homepage on startup, replacing the open tabs', async () => {
  const { ws, paths } = await setup();
  expect(paths()).toEqual(['Home.md']);
  expect(ws.activeLeaf.view.file.path).toBe('Home.md');
});

it('does nothing on startup when that is off', async () => {
  const { paths } = await setup({ openOnStartup: false });
  expect(paths()).toEqual(['Other.md']);
});

it('keeps tabs and opens a new one in "keep" mode; the command switches to it when it is already open', async () => {
  const { app, ws, paths } = await setup({ openMode: 'keep' });
  expect(paths()).toEqual(['Other.md', 'Home.md']);
  ws.setActiveLeaf(ws.getLeavesOfType('markdown').find((l: any) => l.view.file.path === 'Other.md'));
  expect(app.commands.executeCommandById('helenite-homepage:open')).toBe(true);
  await tick(30);
  expect(paths()).toEqual(['Other.md', 'Home.md']);
  expect(ws.activeLeaf.view.file.path).toBe('Home.md');
});

it('creates a missing homepage note, folders included', async () => {
  const { app, paths, vaultPath } = await setup({ target: '[[Notes/Start]]' });
  expect(existsSync(join(vaultPath, 'Notes/Start.md'))).toBe(true);
  expect(app.vault.getFileByPath('Notes/Start.md')).toBeTruthy();
  expect(paths()).toEqual(['Notes/Start.md']);
});

it('shows an error notice instead of creating the note when that is off', async () => {
  const { paths } = await setup({ target: 'Missing', createIfMissing: false });
  expect(paths()).toEqual(['Other.md']);
  expect(document.querySelector('.hel-notice.is-error')?.textContent).toContain('Missing.md does not exist.');
});

it('a new empty tab shows the homepage when that is on, and a tab opened for a file is left alone', async () => {
  const { app, ws, paths } = await setup({ openOnStartup: false, openInNewTab: true });
  const fresh = ws.getLeaf('tab');
  ws.setActiveLeaf(fresh);
  await tick(40);
  expect(fresh.view.file?.path).toBe('Home.md');
  await ws.getLeaf('tab').openFile(app.vault.getFileByPath('Other.md'));
  await tick(40);
  expect(paths()).toEqual(['Other.md', 'Home.md', 'Other.md']);
});

it('the settings tab is built from design-system parts', async () => {
  const { app, plugin } = await setup({ openOnStartup: false });
  const tab = app.setting.pluginTabs.find((t: any) => t.plugin === plugin);
  tab.display();
  const el: HTMLElement = tab.containerEl;
  expect(el.querySelectorAll('.hel-section')).toHaveLength(3);
  expect(el.querySelectorAll('.hel-segmented')).toHaveLength(2);
  const random = [...el.querySelectorAll<HTMLElement>('.hel-segment')].find((b) => b.textContent === 'A random note')!;
  random.click();
  await tick(5);
  expect(plugin.settings.kind).toBe('random');
  expect(tab.containerEl.textContent).not.toContain('Create the note if it is missing');
  const open = [...tab.containerEl.querySelectorAll<HTMLElement>('.hel-button')].find((b) => b.textContent?.includes('Open'));
  expect(open).toBeTruthy();
});
