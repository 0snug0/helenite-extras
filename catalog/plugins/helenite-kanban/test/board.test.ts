import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { isBoardFrontmatter, isBoardMarkdown, newBoardMarkdown, parseBoard, parseLaneTitle, serializeBoard } from '../src/board';

const fixture = (name: string) => readFileSync(join(__dirname, 'fixtures', name), 'utf8');
const strip = (b: ReturnType<typeof parseBoard>) => ({
  lanes: b.lanes.map(({ id: _id, cards, ...l }) => ({ ...l, cards: cards.map(({ id: _cid, ...c }) => c) })),
  archive: b.archive.map(({ id: _id, ...c }) => c),
});

describe('round trip on files written by Obsidian Kanban', () => {
  for (const name of ['full-board.md', 'no-archive.md']) {
    it(`${name} is written back byte for byte`, () => {
      const md = fixture(name);
      expect(serializeBoard(parseBoard(md))).toBe(md);
    });
  }

  it('reads lanes, limits, the complete marker, check chars, block ids and multi-line cards', () => {
    const b = parseBoard(fixture('full-board.md'));
    expect(b.lanes.map((l) => [l.title, l.maxItems, l.markComplete, l.cards.length])).toEqual([
      ['Backlog', 5, false, 5],
      ['Doing', 0, false, 2],
      ['Done', 0, true, 2],
      ['Empty list', 0, false, 0],
    ]);
    const [backlog, doing, done] = b.lanes;
    expect(backlog.cards[2].text).toBe('Two line card\nwith a second line\n- [ ] and a nested task');
    expect(backlog.cards[3]).toMatchObject({ text: 'Card with a block id', blockId: 'k9x2ab' });
    expect(backlog.cards[4].text).toBe('');
    expect(doing.cards[1]).toMatchObject({ checkChar: '/', checked: true });
    expect(done.cards.every((c) => c.checked && c.checkChar === 'x')).toBe(true);
  });

  it('reads the archive section and the settings footer', () => {
    const b = parseBoard(fixture('full-board.md'));
    expect(b.archive.map((c) => c.text)).toEqual(['Archived card one', 'Archived card two']);
    expect(b.settings).toEqual({
      'kanban-plugin': 'board',
      'list-collapse': [false, false, false, false],
      'new-card-insertion-method': 'append',
      'show-checkboxes': true,
    });
  });

  it('keeps other frontmatter keys as written', () => {
    const b = parseBoard(fixture('no-archive.md'));
    expect(b.frontmatter).toBe('kanban-plugin: board\ntags:\n  - project\ncssclasses: wide');
    expect(b.archive).toEqual([]);
  });

  it('indents extra lines with four spaces when tabs are off, and still reads them back', () => {
    const md = fixture('full-board.md');
    const spaced = serializeBoard(parseBoard(md), { useTab: false });
    expect(spaced).toContain('- [ ] Two line card\n    with a second line\n    - [ ] and a nested task\n');
    expect(strip(parseBoard(spaced))).toEqual(strip(parseBoard(md)));
  });
});

describe('normalising hand-written boards', () => {
  const handWritten = '---\nkanban-plugin: basic\n---\n\n## Todo\n\n- [ ] Theme spike\n* Editor spike\n\n## Doing\n\n- [ ] Plugin spike\n  more detail\nlazy line\n';

  it('reads the old `basic` kind, bare bullets and lazy continuation lines', () => {
    const b = parseBoard(handWritten);
    expect(b.settings['kanban-plugin']).toBe('board');
    expect(b.lanes[0].cards.map((c) => [c.text, c.checked])).toEqual([['Theme spike', false], ['Editor spike', false]]);
    expect(b.lanes[1].cards[0].text).toBe('Plugin spike\n  more detail\nlazy line');
  });

  it('writes the canonical layout, and that layout is stable', () => {
    const once = serializeBoard(parseBoard(handWritten));
    expect(once.startsWith('---\n\nkanban-plugin: basic\n\n---\n\n## Todo\n\n- [ ] Theme spike\n- [ ] Editor spike\n\n\n## Doing\n')).toBe(true);
    expect(once.endsWith('\n\n%% kanban:settings\n```\n{"kanban-plugin":"board"}\n```\n%%')).toBe(true);
    expect(serializeBoard(parseBoard(once))).toBe(once);
  });

  it('turns <br> in cards and headings into line breaks, as Obsidian Kanban does', () => {
    const b = parseBoard('---\nkanban-plugin: board\n---\n## A<br>B\n- [ ] one<br>two\n');
    expect(b.lanes[0]).toMatchObject({ title: 'A\nB', maxItems: 0 });
    expect(b.lanes[0].cards[0].text).toBe('one\ntwo');
    expect(serializeBoard(b)).toContain('## A<br>B\n\n- [ ] one\n\ttwo\n');
  });

  it('ignores text before the first lane and survives a broken settings footer', () => {
    const b = parseBoard('---\nkanban-plugin: board\n---\nintro\n- stray\n## L\n- [ ] c\n\n%% kanban:settings\n```\n{not json\n```\n%%');
    expect(b.lanes).toHaveLength(1);
    expect(b.lanes[0].cards.map((c) => c.text)).toEqual(['c']);
    expect(b.settings).toEqual({ 'kanban-plugin': 'board' });
  });

  it('a thematic break not followed by a heading does not start the archive', () => {
    const b = parseBoard('---\nkanban-plugin: board\n---\n## A\n- [ ] a\n\n***\n\npara\n\n## B\n- [ ] b\n');
    expect(b.lanes.map((l) => l.title)).toEqual(['A', 'B']);
    expect(b.archive).toEqual([]);
  });
});

describe('helpers', () => {
  it('detects board notes', () => {
    expect(isBoardMarkdown('---\nkanban-plugin: board\n---\n')).toBe(true);
    expect(isBoardMarkdown('---\n\nkanban-plugin: basic\n\n---\n')).toBe(true);
    expect(isBoardMarkdown('---\ntitle: x\n---\n## kanban-plugin: board')).toBe(false);
    expect(isBoardMarkdown('# no frontmatter')).toBe(false);
    expect(isBoardFrontmatter({ 'kanban-plugin': 'board' })).toBe(true);
    expect(isBoardFrontmatter({ 'kanban-plugin': 'other' })).toBe(false);
    expect(isBoardFrontmatter(undefined)).toBe(false);
  });

  it('parses lane limits', () => {
    expect(parseLaneTitle('Doing (3)')).toEqual({ title: 'Doing', maxItems: 3 });
    expect(parseLaneTitle('Doing(3)')).toEqual({ title: 'Doing', maxItems: 3 });
    expect(parseLaneTitle('Q (three)')).toEqual({ title: 'Q (three)', maxItems: 0 });
  });

  it('a new board has three lanes, the last marking cards complete, and reads back', () => {
    const md = newBoardMarkdown();
    expect(md).toBe('---\n\nkanban-plugin: board\n\n---\n\n## To do\n\n\n\n## Doing\n\n\n\n## Done\n\n**Complete**\n\n\n\n\n%% kanban:settings\n```\n{"kanban-plugin":"board"}\n```\n%%');
    expect(parseBoard(md).lanes.map((l) => [l.title, l.markComplete])).toEqual([['To do', false], ['Doing', false], ['Done', true]]);
  });
});
