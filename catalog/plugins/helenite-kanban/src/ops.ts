// Board edits. Each takes a board and returns a new one; the input is left as it was. Pure, so the view stays thin.
import { newId, type Board, type Card, type Lane } from './board';

const clone = (b: Board): Board => structuredClone(b);

function findCard(b: Board, cardId: string): { list: Card[]; index: number; lane: Lane | null } | null {
  for (const lane of b.lanes) {
    const index = lane.cards.findIndex((c) => c.id === cardId);
    if (index >= 0) return { list: lane.cards, index, lane };
  }
  const index = b.archive.findIndex((c) => c.id === cardId);
  return index >= 0 ? { list: b.archive, index, lane: null } : null;
}

const laneIndex = (b: Board, laneId: string): number => b.lanes.findIndex((l) => l.id === laneId);
const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n));

function setDone(card: Card, done: boolean): void {
  card.checked = done;
  card.checkChar = done ? (card.checkChar !== ' ' ? card.checkChar : 'x') : ' ';
}

export function addLane(board: Board, title: string, at = board.lanes.length): Board {
  const b = clone(board);
  b.lanes.splice(clamp(at, 0, b.lanes.length), 0, { id: newId('l'), title: title.trim(), maxItems: 0, markComplete: false, cards: [] });
  return b;
}

export function renameLane(board: Board, laneId: string, title: string): Board {
  const b = clone(board);
  const lane = b.lanes[laneIndex(b, laneId)];
  if (lane) lane.title = title.trim();
  return b;
}

export function deleteLane(board: Board, laneId: string): Board {
  const b = clone(board);
  b.lanes = b.lanes.filter((l) => l.id !== laneId);
  return b;
}

export function moveLane(board: Board, laneId: string, to: number): Board {
  const b = clone(board);
  const from = laneIndex(b, laneId);
  if (from < 0) return b;
  const [lane] = b.lanes.splice(from, 1);
  b.lanes.splice(clamp(to, 0, b.lanes.length), 0, lane);
  return b;
}

/** Turn "Mark cards in this list as complete" on or off. Turning it on checks off the cards already there. */
export function setMarkComplete(board: Board, laneId: string, on: boolean): Board {
  const b = clone(board);
  const lane = b.lanes[laneIndex(b, laneId)];
  if (!lane) return b;
  lane.markComplete = on;
  if (on) lane.cards.forEach((c) => setDone(c, true));
  return b;
}

export function setMaxItems(board: Board, laneId: string, max: number): Board {
  const b = clone(board);
  const lane = b.lanes[laneIndex(b, laneId)];
  if (lane) lane.maxItems = Math.max(0, Math.floor(max) || 0);
  return b;
}

export function addCard(board: Board, laneId: string, text: string, at?: number): Board {
  const b = clone(board);
  const lane = b.lanes[laneIndex(b, laneId)];
  if (!lane) return b;
  const card: Card = { id: newId('c'), text: text.trim(), checked: false, checkChar: ' ' };
  if (lane.markComplete) setDone(card, true);
  lane.cards.splice(clamp(at ?? lane.cards.length, 0, lane.cards.length), 0, card);
  return b;
}

export function editCard(board: Board, cardId: string, text: string): Board {
  const b = clone(board);
  const hit = findCard(b, cardId);
  if (hit) hit.list[hit.index].text = text.trim();
  return b;
}

export function deleteCard(board: Board, cardId: string): Board {
  const b = clone(board);
  const hit = findCard(b, cardId);
  if (hit) hit.list.splice(hit.index, 1);
  return b;
}

export function toggleCard(board: Board, cardId: string): Board {
  const b = clone(board);
  const hit = findCard(b, cardId);
  if (hit) {
    const card = hit.list[hit.index];
    setDone(card, !card.checked);
  }
  return b;
}

/** Move a card before the `to`th card of a lane, not counting the card itself. Into a "complete" lane checks it off; out of one reopens it. */
export function moveCard(board: Board, cardId: string, toLaneId: string, to: number): Board {
  const b = clone(board);
  const hit = findCard(b, cardId);
  const dest = b.lanes[laneIndex(b, toLaneId)];
  if (!hit || !dest) return b;
  const [card] = hit.list.splice(hit.index, 1);
  const same = hit.list === dest.cards;
  if (dest.markComplete) setDone(card, true);
  else if (hit.lane?.markComplete && !same) setDone(card, false);
  dest.cards.splice(clamp(to, 0, dest.cards.length), 0, card);
  return b;
}

/** Move a card to the archive section (the end of the note, under `***` and `## Archive`). */
export function archiveCard(board: Board, cardId: string): Board {
  const b = clone(board);
  const hit = findCard(b, cardId);
  if (!hit || !hit.lane) return b;
  const [card] = hit.list.splice(hit.index, 1);
  b.archive.push(card);
  return b;
}

export function restoreCard(board: Board, cardId: string, laneId: string): Board {
  const b = clone(board);
  const index = b.archive.findIndex((c) => c.id === cardId);
  const lane = b.lanes[laneIndex(b, laneId)];
  if (index < 0 || !lane) return b;
  const [card] = b.archive.splice(index, 1);
  if (lane.markComplete) setDone(card, true);
  lane.cards.push(card);
  return b;
}

/** Archive every checked card in a lane. */
export function archiveDone(board: Board, laneId: string): Board {
  const b = clone(board);
  const lane = b.lanes[laneIndex(b, laneId)];
  if (!lane) return b;
  b.archive.push(...lane.cards.filter((c) => c.checked));
  lane.cards = lane.cards.filter((c) => !c.checked);
  return b;
}
