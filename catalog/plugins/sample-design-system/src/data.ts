// The plugin's saved data. The sample keeps a small list of items so every part has something real to show.
import type { VaultScope } from 'helenite';

export type Status = 'todo' | 'doing' | 'done';
export type Kind = 'note' | 'link';

export interface Item {
  id: string;
  name: string;
  kind: Kind;
  status: Status;
  pinned: boolean;
}

export interface Data {
  items: Item[];
  density: 'compact' | 'detailed';
  scope: VaultScope;
}

export const STATUSES: { id: Status; text: string; tone: 'default' | 'accent' | 'success' }[] = [
  { id: 'todo', text: 'To do', tone: 'default' },
  { id: 'doing', text: 'Doing', tone: 'accent' },
  { id: 'done', text: 'Done', tone: 'success' },
];

/** "1 item", "2 items". */
export const count = (n: number, noun: string) => `${n} ${noun}${n === 1 ? '' : 's'}`;

export const statusOf = (item: Item) => STATUSES.find((s) => s.id === item.status) ?? STATUSES[0];

const SEED: Item[] = [
  { id: '1', name: 'Reading list', kind: 'note', status: 'doing', pinned: true },
  { id: '2', name: 'Design references', kind: 'link', status: 'todo', pinned: false },
  { id: '3', name: 'Weekly review', kind: 'note', status: 'todo', pinned: false },
  { id: '4', name: 'Release checklist', kind: 'note', status: 'done', pinned: false },
];

/** Fills in what saved data lacks (an item saved before it had a status). */
export function readData(saved: unknown): Data {
  const s = (saved ?? {}) as Partial<Data>;
  const items = s.items ?? SEED;
  return {
    items: items.map((i) => ({ ...i, status: i.status ?? 'todo', pinned: i.pinned ?? false })),
    density: s.density ?? 'detailed',
    scope: s.scope ?? 'all',
  };
}
