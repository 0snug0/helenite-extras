// Loads the built plugin (run `pnpm --filter @helenite/helenite-kanban build` first; `pnpm test` here does) into a real
// Helenite App and drives the board view through its design-system controls.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { loadBuiltPlugin, makeApp, tick } from '../../core-build/test/harness';

const BOARD = '---\n\nkanban-plugin: board\n\n---\n\n## To do\n\n- [ ] a\n- [ ] b\n\n\n## Done\n\n**Complete**\n- [x] c\n\n\n\n\n%% kanban:settings\n```\n{"kanban-plugin":"board"}\n```\n%%';

async function setup(files: Record<string, string> = { 'Board.md': BOARD, 'Plain.md': 'hello' }) {
  const { app, vaultPath } = await makeApp(files);
  const plugin: any = await loadBuiltPlugin(app, 'helenite-kanban');
  expect(plugin).toBeTruthy();
  (app.workspace as any).triggerLayoutReady?.();
  const disk = (p: string) => readFileSync(join(vaultPath, p), 'utf8');
  return { app: app as any, plugin, disk };
}

async function openBoard(app: any) {
  const leaf = app.workspace.getLeaf(false);
  await leaf.openFile(app.vault.getFileByPath('Board.md'));
  for (let i = 0; i < 50 && !(leaf.view.getViewType() === 'helenite-kanban' && leaf.view.data); i++) await tick(10);
  return leaf;
}

async function answerPrompt(value: string) {
  await tick(5);
  const modal = document.querySelector('.hel-modal') as HTMLElement;
  const input = modal.querySelector('.hel-modal-input') as HTMLInputElement;
  input.value = value;
  input.dispatchEvent(new Event('input'));
  (modal.querySelector('.hel-modal-actions .mod-cta') as HTMLElement).click();
  await tick(20);
}

it('a board note opens as a board, and a plain note stays markdown', async () => {
  const { app } = await setup();
  const leaf = await openBoard(app);
  expect(leaf.view.getViewType()).toBe('helenite-kanban');
  const lanes = leaf.view.contentEl.querySelectorAll('.helenite-kanban-lane');
  expect([...lanes].map((l: any) => l.querySelector('.helenite-kanban-lane-title').textContent)).toEqual(['To do', 'Done']);
  expect(lanes[0].querySelectorAll('.helenite-kanban-card')).toHaveLength(2);
  expect(lanes[0].querySelector('.hel-badge')?.textContent).toBe('2');

  const other = app.workspace.getLeaf('tab');
  await other.openFile(app.vault.getFileByPath('Plain.md'));
  await tick(20);
  expect(other.view.getViewType()).toBe('markdown');
});

it('checking a card and adding a card write the Obsidian Kanban format back to the note', async () => {
  const { app, disk } = await setup();
  const leaf = await openBoard(app);
  const root: HTMLElement = leaf.view.contentEl;
  (root.querySelector('.helenite-kanban-check') as HTMLInputElement).click();
  await tick(20);
  expect(disk('Board.md')).toContain('## To do\n\n- [x] a\n- [ ] b\n');

  const addCard = [...root.querySelectorAll('.helenite-kanban-lane')][0].querySelector('.hel-button.is-link') as HTMLElement;
  addCard.click();
  await answerPrompt('New card<br>with detail');
  expect(disk('Board.md')).toContain('- [ ] b\n- [ ] New card\n\twith detail\n\n\n## Done');
  expect(disk('Board.md').endsWith('%% kanban:settings\n```\n{"kanban-plugin":"board"}\n```\n%%')).toBe(true);
});

it('deleting a list asks first and says it cannot be undone', async () => {
  const { app, disk } = await setup();
  const leaf = await openBoard(app);
  const done = [...leaf.view.contentEl.querySelectorAll('.helenite-kanban-lane')][1] as HTMLElement;
  (done.querySelector('.helenite-kanban-lane-header .hel-button') as HTMLElement).click();
  await tick(5);
  const item = [...document.querySelectorAll<HTMLElement>('.menu-item')].find((m) => m.textContent?.includes('Delete list'))!;
  expect(item.classList.contains('is-danger')).toBe(true);
  item.click();
  await tick(5);
  const modal = document.querySelector('.hel-modal') as HTMLElement;
  expect(modal.textContent).toContain('Delete Done and its 1 card? This cannot be undone.');
  (modal.querySelector('.hel-button.mod-warning') as HTMLElement).click();
  await tick(20);
  expect(disk('Board.md')).not.toContain('## Done');
});

it('just viewing a hand-written board leaves the file as it was', async () => {
  const hand = '---\nkanban-plugin: basic\n---\n\n## Todo\n\n- [ ] Theme spike\n';
  const { app, disk } = await setup({ 'Board.md': hand });
  const leaf = await openBoard(app);
  expect(leaf.view.getViewType()).toBe('helenite-kanban');
  await leaf.view.save();
  leaf.detach();
  await tick(20);
  expect(disk('Board.md')).toBe(hand);
});

it('"Open as markdown" keeps that tab in markdown, and the command switches back', async () => {
  const { app } = await setup();
  const leaf = await openBoard(app);
  app.workspace.setActiveLeaf(leaf);
  (app.plugins.getPlugin('helenite-kanban') as any).openAsMarkdown(leaf);
  await tick(30);
  expect(leaf.view.getViewType()).toBe('markdown');
  expect(app.commands.executeCommandById('helenite-kanban:toggle-view')).toBe(true);
  await tick(30);
  expect(leaf.view.getViewType()).toBe('helenite-kanban');
});

it('the "New board" command creates a board note and opens it as a board', async () => {
  const { app, disk } = await setup({});
  expect(app.commands.executeCommandById('helenite-kanban:create-board')).toBe(true);
  for (let i = 0; i < 30 && !app.vault.getFileByPath('Untitled Kanban.md'); i++) await tick(10);
  await tick(30);
  expect(disk('Untitled Kanban.md')).toContain('kanban-plugin: board');
  expect(app.workspace.getLeavesOfType('helenite-kanban')).toHaveLength(1);
});
