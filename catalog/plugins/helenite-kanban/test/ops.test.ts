import { describe, expect, it } from 'vitest';
import { parseBoard, serializeBoard } from '../src/board';
import * as ops from '../src/ops';

const md = '---\n\nkanban-plugin: board\n\n---\n\n## To do\n\n- [ ] a\n- [ ] b\n- [ ] c\n\n\n\n## Done\n\n**Complete**\n- [x] d\n\n\n\n\n%% kanban:settings\n```\n{"kanban-plugin":"board"}\n```\n%%';
const texts = (b: ops_Board) => b.lanes.map((l) => l.cards.map((c) => (c.checked ? `${c.text}✓` : c.text)));
type ops_Board = ReturnType<typeof parseBoard>;

describe('board edits', () => {
  it('never change the board they are given', () => {
    const b = parseBoard(md);
    const before = JSON.stringify(b);
    ops.addCard(b, b.lanes[0].id, 'x');
    ops.deleteLane(b, b.lanes[0].id);
    ops.moveCard(b, b.lanes[0].cards[0].id, b.lanes[1].id, 0);
    expect(JSON.stringify(b)).toBe(before);
  });

  it('add, edit, toggle and delete cards', () => {
    let b = parseBoard(md);
    const [todo, done] = b.lanes;
    b = ops.addCard(b, todo.id, '  new card  ');
    b = ops.addCard(b, todo.id, 'top', 0);
    b = ops.addCard(b, done.id, 'born done');
    expect(texts(b)).toEqual([['top', 'a', 'b', 'c', 'new card'], ['d✓', 'born done✓']]);
    b = ops.editCard(b, b.lanes[0].cards[1].id, 'a, edited\nsecond line');
    b = ops.toggleCard(b, b.lanes[0].cards[2].id);
    b = ops.deleteCard(b, b.lanes[0].cards[0].id);
    expect(texts(b)[0]).toEqual(['a, edited\nsecond line', 'b✓', 'c', 'new card']);
    expect(serializeBoard(b)).toContain('## To do\n\n- [ ] a, edited\n\tsecond line\n- [x] b\n- [ ] c\n- [ ] new card\n');
  });

  it('move cards within and across lanes, checking off in a complete lane and reopening out of it', () => {
    let b = parseBoard(md);
    const [todo, done] = b.lanes;
    const [a, , c] = todo.cards;
    b = ops.moveCard(b, a.id, todo.id, 3); // to the end of its own lane
    expect(texts(b)[0]).toEqual(['b', 'c', 'a']);
    b = ops.moveCard(b, c.id, todo.id, 0);
    expect(texts(b)[0]).toEqual(['c', 'b', 'a']);
    b = ops.moveCard(b, c.id, done.id, 0);
    expect(texts(b)).toEqual([['b', 'a'], ['c✓', 'd✓']]);
    b = ops.moveCard(b, b.lanes[1].cards[1].id, todo.id, 99);
    expect(texts(b)).toEqual([['b', 'a', 'd'], ['c✓']]);
  });

  it('add, rename, move and delete lanes', () => {
    let b = parseBoard(md);
    b = ops.addLane(b, ' Doing ', 1);
    expect(b.lanes.map((l) => l.title)).toEqual(['To do', 'Doing', 'Done']);
    b = ops.renameLane(b, b.lanes[1].id, 'In progress');
    b = ops.moveLane(b, b.lanes[2].id, 0);
    expect(b.lanes.map((l) => l.title)).toEqual(['Done', 'To do', 'In progress']);
    b = ops.setMaxItems(b, b.lanes[2].id, 4);
    b = ops.deleteLane(b, b.lanes[0].id);
    expect(serializeBoard(b)).toContain('## To do\n\n- [ ] a\n- [ ] b\n- [ ] c\n\n\n## In progress (4)\n\n\n\n\n\n%%');
  });

  it('turning on "complete" checks off the lane\'s cards', () => {
    let b = parseBoard(md);
    b = ops.setMarkComplete(b, b.lanes[0].id, true);
    expect(texts(b)[0]).toEqual(['a✓', 'b✓', 'c✓']);
    expect(serializeBoard(b)).toContain('## To do\n\n**Complete**\n- [x] a\n');
  });

  it('archive and restore cards', () => {
    let b = parseBoard(md);
    b = ops.archiveCard(b, b.lanes[0].cards[0].id);
    b = ops.archiveDone(b, b.lanes[1].id);
    expect(b.archive.map((c) => c.text)).toEqual(['a', 'd']);
    const out = serializeBoard(b);
    expect(out).toContain('***\n\n## Archive\n\n- [ ] a\n- [x] d\n\n%% kanban:settings');
    expect(parseBoard(out).archive.map((c) => c.text)).toEqual(['a', 'd']);
    b = ops.restoreCard(b, b.archive[1].id, b.lanes[0].id);
    expect(texts(b)[0]).toEqual(['b', 'c', 'd✓']);
    expect(b.archive.map((c) => c.text)).toEqual(['a']);
  });
});
