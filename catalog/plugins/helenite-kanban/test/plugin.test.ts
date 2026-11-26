// Loads the built plugin (run `pnpm --filter @helenite/helenite-kanban build` first; `pnpm test` here does) into a real
// Helenite App and drives the board view through its design-system controls.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { loadBuiltPlugin, makeApp, tick } from '../../../../../plugins/core-build/test/harness';

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
  const lanes = leaf.view.contentEl.querySelectorAll('.hel-board-lane');
  expect([...lanes].map((l: any) => l.getAttribute('aria-label'))).toEqual(['To do', 'Done']);
  expect(lanes[0].querySelectorAll('.hel-board-card')).toHaveLength(2);
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
  (root.querySelector('.hel-board-card-check > input') as HTMLInputElement).click();
  await tick(20);
  expect(disk('Board.md')).toContain('## To do\n\n- [x] a\n- [ ] b\n');

  const addCard = root.querySelector('.hel-board-lane-footer > .hel-button') as HTMLElement;
  addCard.click();
  await answerPrompt('New card<br>with detail');
  expect(disk('Board.md')).toContain('- [ ] b\n- [ ] New card\n\twith detail\n\n\n## Done');
  expect(disk('Board.md').endsWith('%% kanban:settings\n```\n{"kanban-plugin":"board"}\n```\n%%')).toBe(true);
});

it('deleting a list asks first and says it cannot be undone', async () => {
  const { app, disk } = await setup();
  const leaf = await openBoard(app);
  const done = [...leaf.view.contentEl.querySelectorAll('.hel-board-lane')][1] as HTMLElement;
  (done.querySelector('[aria-label="List options"]') as HTMLElement).click();
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

it('dragging a card onto another list moves it, and checks it off in a complete list', async () => {
  const { app, disk } = await setup();
  const leaf = await openBoard(app);
  const root: HTMLElement = leaf.view.contentEl;
  const card = root.querySelector('.hel-board-card') as HTMLElement;
  expect(card.getAttribute('draggable')).toBe('true');
  card.dispatchEvent(new Event('dragstart', { bubbles: true }));
  const done = root.querySelectorAll('.hel-board-list')[1] as HTMLElement;
  const drop = new Event('drop', { bubbles: true, cancelable: true });
  Object.assign(drop, { clientY: 1000 });
  done.dispatchEvent(drop);
  await tick(20);
  expect(disk('Board.md')).toContain('## To do\n\n- [ ] b\n\n\n## Done\n\n**Complete**\n- [x] c\n- [x] a\n');
  expect(root.querySelectorAll('.hel-board-card.is-muted')).toHaveLength(2);
});

it('a card dropped after the note changed under the drag writes nothing', async () => {
  const { app, disk } = await setup();
  const leaf = await openBoard(app);
  const root: HTMLElement = leaf.view.contentEl;
  const list = root.querySelectorAll('.hel-board-list')[1] as HTMLElement;
  (root.querySelector('.hel-board-card') as HTMLElement).dispatchEvent(new Event('dragstart', { bubbles: true }));
  // Written by hand, so any rewrite would show.
  const changed = '---\nkanban-plugin: basic\n---\n\n## To do\n\n- [ ] b2\n';
  await app.vault.modify(app.vault.getFileByPath('Board.md'), changed);
  await tick(30);
  list.dispatchEvent(new Event('drop', { bubbles: true, cancelable: true }));
  await tick(20);
  expect(disk('Board.md')).toBe(changed);
  expect(root.textContent).toContain('b2');
});

it('a list keeps its scroll when the list before it moves', async () => {
  const { app } = await setup();
  const leaf = await openBoard(app);
  const root: HTMLElement = leaf.view.contentEl;
  const lists = () => [...root.querySelectorAll<HTMLElement>('.hel-board-list')];
  lists()[0].scrollTop = 40;
  (root.querySelector('[aria-label="List options"]') as HTMLElement).click();
  await tick(5);
  [...document.querySelectorAll<HTMLElement>('.menu-item')].find((m) => m.textContent?.includes('Move list right'))!.click();
  await tick(20);
  expect(lists().map((l) => l.scrollTop)).toEqual([0, 40]);
});

it('clicking a list name renames the list', async () => {
  const { app, disk } = await setup();
  const leaf = await openBoard(app);
  (leaf.view.contentEl.querySelector('.hel-board-lane-head > button.hel-board-lane-title') as HTMLElement).click();
  await answerPrompt('Soon');
  expect(disk('Board.md')).toContain('## Soon\n\n- [ ] a');
});

it("a card is a checkbox, its markdown and its menu, in the design system's card row", async () => {
  const { app } = await setup();
  const leaf = await openBoard(app);
  await tick(20);
  const card = leaf.view.contentEl.querySelector('.hel-board-card') as HTMLElement;
  expect(card.querySelector('.hel-board-card-check > input')?.getAttribute('aria-label')).toBe('Mark card as done');
  expect(card.querySelector('.hel-board-card-content.markdown-rendered')?.textContent).toBe('a');
  expect(card.querySelector('.hel-board-card-actions > [aria-label="Card options"]')).not.toBeNull();
});

it("double-clicking a card's text edits the card", async () => {
  const { app, disk } = await setup();
  const leaf = await openBoard(app);
  (leaf.view.contentEl.querySelector('.hel-board-card-content') as HTMLElement).dispatchEvent(new Event('dblclick'));
  await answerPrompt('a2');
  expect(disk('Board.md')).toContain('- [ ] a2\n- [ ] b');
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
