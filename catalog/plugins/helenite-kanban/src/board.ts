// Reads and writes Kanban board notes in the format Obsidian's Kanban plugin uses (mgmeyers/obsidian-kanban, list
// format), so a board edited here opens unchanged there and the other way round. Pure: no DOM, no Obsidian API.
//
// A board note looks like this:
//
//   ---
//
//   kanban-plugin: board
//
//   ---
//
//   ## To do
//
//   - [ ] A card
//   	a second line, indented
//
//
//   ## Done
//
//   **Complete**
//   - [x] Done card
//
//
//   ***
//
//   ## Archive
//
//   - [x] Old card
//
//   %% kanban:settings
//   ```
//   {"kanban-plugin":"board"}
//   ```
//   %%

export const FRONTMATTER_KEY = 'kanban-plugin';

export interface Card {
  id: string;
  /** The card's markdown, without the checkbox, block id or line indentation. May span several lines. */
  text: string;
  checked: boolean;
  /** The character between the brackets: ' ' for an open card, usually 'x' for a done one. */
  checkChar: string;
  /** A trailing `^id` on the card's first line, kept so links to the card survive a rewrite. */
  blockId?: string;
}

export interface Lane {
  id: string;
  title: string;
  /** The card limit written as `## Title (5)`; 0 when there is none. */
  maxItems: number;
  /** A `**Complete**` line under the heading: cards moved here are checked off. */
  markComplete: boolean;
  cards: Card[];
}

export interface Board {
  /** The YAML between the frontmatter fences, trimmed. Kept as written. */
  frontmatter: string;
  lanes: Lane[];
  archive: Card[];
  /** The JSON in the `%% kanban:settings` footer, with `kanban-plugin` copied in from the frontmatter. */
  settings: Record<string, unknown>;
}

export interface SerializeOptions {
  /** Obsidian's "Indent using tabs" (on by default). Off indents a card's extra lines with four spaces. */
  useTab?: boolean;
}

let nextId = 0;
export const newId = (prefix: string): string => `${prefix}${++nextId}`;

const FRONTMATTER = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;
const SETTINGS_FOOTER = /(?:\r?\n)*%% kanban:settings[ \t]*\r?\n```[^\n]*\r?\n([\s\S]*?)\r?\n```[ \t]*\r?\n%%\s*$/;
const HEADING = /^ {0,3}(#{1,6})[ \t]+(.*?)[ \t]*$/;
const THEMATIC_BREAK = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/;
const LIST_ITEM = /^ {0,3}(?:[-*+]|\d{1,9}[.)])(?:[ \t]+(.*))?$/;
const TASK = /^\[(.)\](?:[ \t]+([\s\S]*))?$/;
const BLOCK_ID = /\s+\^([a-zA-Z0-9-]+)$/;
const COMPLETE = '**Complete**';
const ARCHIVE_BREAK = '***';
const ARCHIVE_TITLE = 'Archive';

/** True when the note's frontmatter marks it as a board (`kanban-plugin: board`, or the old `basic`). */
export function isBoardMarkdown(md: string): boolean {
  const fm = FRONTMATTER.exec(md);
  return !!fm && boardKind(fm[1]) !== null;
}

/** True for a frontmatter object (from the metadata cache) that marks a board. */
export function isBoardFrontmatter(fm: Record<string, unknown> | undefined | null): boolean {
  const v = fm?.[FRONTMATTER_KEY];
  return v === 'board' || v === 'basic';
}

function boardKind(yaml: string): string | null {
  const m = /^kanban-plugin:[ \t]*["']?([^"'\s#]+)["']?[ \t]*(?:#.*)?$/m.exec(yaml);
  return m ? m[1] : null;
}

/** `To do (5)` → title and card limit; `<br>` in a heading is a line break, as Obsidian's Kanban writes it. */
export function parseLaneTitle(raw: string): { title: string; maxItems: number } {
  const str = raw.replace(/<br>/g, '\n').trim();
  const m = /^(.*?)\s*\((\d+)\)$/.exec(str);
  return m ? { title: m[1], maxItems: Number(m[2]) } : { title: str, maxItems: 0 };
}

function laneHeading(lane: Lane): string {
  const t = lane.maxItems ? `${lane.title} (${lane.maxItems})` : lane.title;
  return t.trim().replace(/\r?\n/g, '<br>');
}

/** A card's source lines (first line after the marker, then its continuation lines as written) → a Card. */
function toCard(first: string, rest: string[]): Card {
  let checkChar = ' ';
  let head = first;
  const task = TASK.exec(first);
  if (task) {
    checkChar = task[1];
    head = task[2] ?? '';
  }
  // Obsidian's Kanban strips one indent level from continuation lines, then turns <br> into line breaks.
  let text = [head, ...rest].join('\n').trim().replace(/\r?\n(?: {4}|\t)/g, '\n').replace(/<br>/g, '\n').trim();
  const lines = text.split('\n');
  let blockId: string | undefined;
  const bid = BLOCK_ID.exec(lines[0]);
  if (bid) {
    blockId = bid[1];
    lines[0] = lines[0].slice(0, bid.index);
    text = lines.join('\n');
  }
  const card: Card = { id: newId('c'), text, checked: checkChar !== ' ', checkChar };
  if (blockId) card.blockId = blockId;
  return card;
}

/** Parse a board note. Anything outside lanes (text before the first heading, stray paragraphs) is dropped on write,
 *  as it is in Obsidian's Kanban. */
export function parseBoard(md: string): Board {
  let body = md;
  let frontmatter = '';
  const fm = FRONTMATTER.exec(md);
  if (fm) {
    frontmatter = fm[1].trim();
    body = md.slice(fm[0].length);
  }

  let settings: Record<string, unknown> = {};
  const footer = SETTINGS_FOOTER.exec(body);
  if (footer) {
    try {
      const parsed = JSON.parse(footer[1].trim());
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) settings = parsed;
    } catch {
      // An unreadable footer is replaced by a fresh one on write.
    }
    body = body.slice(0, footer.index);
  }
  const kind = boardKind(frontmatter);
  if (kind) settings[FRONTMATTER_KEY] = kind === 'basic' ? 'board' : kind;

  const board: Board = { frontmatter, lanes: [], archive: [], settings };
  let target: Card[] | null = null;
  let lane: Lane | null = null;
  let afterBreak = false;
  let item: { first: string; rest: string[]; blanks: number } | null = null;

  const flush = () => {
    if (item && target) target.push(toCard(item.first, item.rest));
    item = null;
  };

  for (const line of body.split(/\r?\n/)) {
    const heading = HEADING.exec(line);
    if (heading) {
      flush();
      if (afterBreak) {
        target = board.archive;
        lane = null;
      } else {
        lane = { id: newId('l'), ...parseLaneTitle(heading[2]), markComplete: false, cards: [] };
        board.lanes.push(lane);
        target = lane.cards;
      }
      afterBreak = false;
      continue;
    }
    if (THEMATIC_BREAK.test(line) && !(item && /^\s/.test(line))) {
      flush();
      afterBreak = true;
      continue;
    }
    if (!line.trim()) {
      if (item) item.blanks++;
      continue;
    }
    const li = LIST_ITEM.exec(line);
    if (li && target) {
      flush();
      item = { first: li[1] ?? '', rest: [], blanks: 0 };
      afterBreak = false;
      continue;
    }
    if (item && (/^\s/.test(line) || item.blanks === 0)) {
      // An indented line, or a lazy continuation right under the item, belongs to the card.
      for (; item.blanks > 0; item.blanks--) item.rest.push('');
      item.rest.push(line);
      continue;
    }
    flush();
    afterBreak = false;
    if (lane && line.trim() === COMPLETE && lane.cards.length === 0) lane.markComplete = true;
  }
  flush();
  return board;
}

function cardToMd(card: Card, indent: string): string {
  const lines = card.text.trim().replace(/\r?\n/g, `\n${indent}`).split('\n');
  if (card.blockId) lines[0] += ` ^${card.blockId}`;
  return `- [${card.checkChar}] ${lines.join('\n')}`;
}

/** Write a board back in Obsidian's Kanban layout, byte for byte what that plugin writes for the same board. */
export function serializeBoard(board: Board, o: SerializeOptions = {}): string {
  const indent = o.useTab === false ? '    ' : '\t';
  const yaml = board.frontmatter.trim() || `${FRONTMATTER_KEY}: board`;
  let out = ['---', '', `${yaml}\n`, '---', '', ''].join('\n');
  for (const lane of board.lanes) {
    const lines = [`## ${laneHeading(lane)}`, ''];
    if (lane.markComplete) lines.push(COMPLETE);
    for (const c of lane.cards) lines.push(cardToMd(c, indent));
    lines.push('', '', '');
    out += lines.join('\n');
  }
  if (board.archive.length) {
    out += [ARCHIVE_BREAK, '', `## ${ARCHIVE_TITLE}`, '', ...board.archive.map((c) => cardToMd(c, indent))].join('\n');
  }
  const settings = { ...board.settings };
  if (!(FRONTMATTER_KEY in settings)) settings[FRONTMATTER_KEY] = boardKind(yaml) ?? 'board';
  out += ['', '', '%% kanban:settings', '```', JSON.stringify(settings), '```', '%%'].join('\n');
  return out;
}

/** A new board note with the given lanes. */
export function newBoardMarkdown(lanes: string[] = ['To do', 'Doing', 'Done']): string {
  return serializeBoard({
    frontmatter: `${FRONTMATTER_KEY}: board`,
    lanes: lanes.map((title, i) => ({ id: newId('l'), title, maxItems: 0, markComplete: i === lanes.length - 1 && lanes.length > 1, cards: [] })),
    archive: [],
    settings: { [FRONTMATTER_KEY]: 'board' },
  });
}
