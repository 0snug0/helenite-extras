// What the homepage is and where it opens. Pure: no DOM, no Obsidian API, so it is unit-tested on its own.

export type HomepageKind = 'note' | 'random';
/** Replace every open tab, replace the tab in use, or keep tabs and open a new one. */
export type OpenMode = 'replace-all' | 'replace-last' | 'keep';
export type ViewMode = 'default' | 'reading' | 'editing';
/** When the homepage is already open: switch to that tab, switch and reload it, or open another copy. */
export type RefreshMode = 'switch' | 'reload' | 'duplicate';

export interface HomepageSettings {
  kind: HomepageKind;
  /** Vault path of the note, as typed: `Home`, `Home.md`, `[[Home]]` and `/Home.md` all mean `Home.md`. */
  target: string;
  openOnStartup: boolean;
  openInNewTab: boolean;
  openMode: OpenMode;
  view: ViewMode;
  refresh: RefreshMode;
  createIfMissing: boolean;
}

export const DEFAULT_SETTINGS: HomepageSettings = {
  kind: 'note',
  target: 'Home',
  openOnStartup: true,
  openInNewTab: false,
  openMode: 'replace-all',
  view: 'default',
  refresh: 'switch',
  createIfMissing: true,
};

/** Saved data → settings, dropping unknown or invalid values in favour of the defaults. */
export function readSettings(saved: unknown): HomepageSettings {
  const s = (saved && typeof saved === 'object' ? saved : {}) as Record<string, unknown>;
  const pick = <T extends string>(v: unknown, allowed: readonly T[], d: T): T => (allowed.includes(v as T) ? (v as T) : d);
  const bool = (v: unknown, d: boolean): boolean => (typeof v === 'boolean' ? v : d);
  const D = DEFAULT_SETTINGS;
  return {
    kind: pick(s.kind, ['note', 'random'], D.kind),
    target: typeof s.target === 'string' ? s.target : D.target,
    openOnStartup: bool(s.openOnStartup, D.openOnStartup),
    openInNewTab: bool(s.openInNewTab, D.openInNewTab),
    openMode: pick(s.openMode, ['replace-all', 'replace-last', 'keep'], D.openMode),
    view: pick(s.view, ['default', 'reading', 'editing'], D.view),
    refresh: pick(s.refresh, ['switch', 'reload', 'duplicate'], D.refresh),
    createIfMissing: bool(s.createIfMissing, D.createIfMissing),
  };
}

/** `[[Home|alias]]`, `/Home`, ` Home.md ` → `Home.md`. Empty input stays empty. */
export function normalizeTarget(input: string): string {
  let p = input.trim();
  const link = /^\[\[([^\]|#]+)(?:[#|][^\]]*)?\]\]$/.exec(p);
  if (link) p = link[1].trim();
  p = p.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/{2,}/g, '/');
  if (!p) return '';
  const name = p.slice(p.lastIndexOf('/') + 1);
  return /\.[A-Za-z0-9]+$/.test(name) ? p : `${p}.md`;
}

export interface VaultLookup {
  exists(path: string): boolean;
  /** All markdown notes, for a random pick. */
  notes(): string[];
  /** A number in [0, 1); Math.random in the app, fixed in tests. */
  random(): number;
}

export type Resolution = { ok: true; path: string; create: boolean } | { ok: false; reason: string };

export function resolveTarget(s: HomepageSettings, vault: VaultLookup): Resolution {
  if (s.kind === 'random') {
    const notes = vault.notes();
    if (!notes.length) return { ok: false, reason: 'There are no notes to pick from.' };
    return { ok: true, path: notes[Math.min(notes.length - 1, Math.floor(vault.random() * notes.length))], create: false };
  }
  const path = normalizeTarget(s.target);
  if (!path) return { ok: false, reason: 'Choose a homepage note in Settings, Homepage.' };
  if (vault.exists(path)) return { ok: true, path, create: false };
  if (s.createIfMissing && path.endsWith('.md')) return { ok: true, path, create: true };
  return { ok: false, reason: `${path} does not exist.` };
}

/** One tab in the main area, as the plan sees it. */
export interface TabInfo {
  id: string;
  /** The open file's path, or null for an empty tab or a view without a file. */
  path: string | null;
  empty: boolean;
  pinned: boolean;
  active: boolean;
}

export interface OpenPlan {
  /** focus: show `leaf` as is. reload: show `leaf` and load the note again. open: load the note into `leaf`, or into a
   *  new tab when `leaf` is null. */
  action: 'focus' | 'reload' | 'open';
  leaf: string | null;
  /** Tabs to close first. Pinned tabs are never closed. */
  close: string[];
}

/** Decide which tab gets the homepage and which tabs close. */
export function planOpen(tabs: TabInfo[], path: string, mode: OpenMode, refresh: RefreshMode): OpenPlan {
  const closable = (keep: string | null) => (mode === 'replace-all' ? tabs.filter((t) => t.id !== keep && !t.pinned).map((t) => t.id) : []);
  const existing = refresh === 'duplicate' ? undefined : tabs.find((t) => t.path === path);
  if (existing) return { action: refresh === 'reload' ? 'reload' : 'focus', leaf: existing.id, close: closable(existing.id) };

  const active = tabs.find((t) => t.active) ?? null;
  const usable = (t: TabInfo | null | undefined) => (t && !t.pinned ? t : null);
  let leaf: TabInfo | null;
  if (mode === 'keep') leaf = active?.empty ? active : null;
  else if (mode === 'replace-last') leaf = usable(active);
  else leaf = usable(active) ?? tabs.find((t) => !t.pinned) ?? null;
  return { action: 'open', leaf: leaf?.id ?? null, close: closable(leaf?.id ?? null) };
}

/** The open state for `leaf.openFile`: reading or editing mode, or nothing so the note opens the app's default way. */
export function openStateFor(view: ViewMode): { state?: { mode: 'preview' | 'source' } } {
  if (view === 'reading') return { state: { mode: 'preview' } };
  if (view === 'editing') return { state: { mode: 'source' } };
  return {};
}
