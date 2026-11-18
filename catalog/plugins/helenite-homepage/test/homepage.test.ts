import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, normalizeTarget, openStateFor, planOpen, readSettings, resolveTarget, type TabInfo } from '../src/homepage';

const vault = (paths: string[], r = 0) => ({ exists: (p: string) => paths.includes(p), notes: () => paths.filter((p) => p.endsWith('.md')), random: () => r });
const settings = (o: Partial<typeof DEFAULT_SETTINGS> = {}) => ({ ...DEFAULT_SETTINGS, ...o });
const tab = (id: string, o: Partial<TabInfo> = {}): TabInfo => ({ id, path: `${id}.md`, empty: false, pinned: false, active: false, ...o });

describe('target resolution', () => {
  it('normalises what the user typed', () => {
    expect(normalizeTarget('Home')).toBe('Home.md');
    expect(normalizeTarget(' /Folder//Home ')).toBe('Folder/Home.md');
    expect(normalizeTarget('[[Daily/Home|my home]]')).toBe('Daily/Home.md');
    expect(normalizeTarget('[[Home#Today]]')).toBe('Home.md');
    expect(normalizeTarget('Boards\\Work.canvas')).toBe('Boards/Work.canvas');
    expect(normalizeTarget('v1.2/Home')).toBe('v1.2/Home.md');
    expect(normalizeTarget('   ')).toBe('');
  });

  it('finds an existing note', () => {
    expect(resolveTarget(settings({ target: 'Home' }), vault(['Home.md']))).toEqual({ ok: true, path: 'Home.md', create: false });
  });

  it('creates a missing markdown note only when allowed', () => {
    expect(resolveTarget(settings({ target: 'Start' }), vault([]))).toEqual({ ok: true, path: 'Start.md', create: true });
    expect(resolveTarget(settings({ target: 'Start', createIfMissing: false }), vault([]))).toEqual({ ok: false, reason: 'Start.md does not exist.' });
    expect(resolveTarget(settings({ target: 'Map.canvas' }), vault([]))).toMatchObject({ ok: false });
  });

  it('asks for a note when none is set', () => {
    expect(resolveTarget(settings({ target: '' }), vault(['Home.md']))).toMatchObject({ ok: false, reason: expect.stringContaining('Choose a homepage note') });
  });

  it('picks a random note', () => {
    const v = vault(['a.md', 'b.md', 'c.md', 'pic.png'], 0.99);
    expect(resolveTarget(settings({ kind: 'random' }), v)).toEqual({ ok: true, path: 'c.md', create: false });
    expect(resolveTarget(settings({ kind: 'random' }), vault(['a.md'], 0))).toEqual({ ok: true, path: 'a.md', create: false });
    expect(resolveTarget(settings({ kind: 'random' }), vault([]))).toMatchObject({ ok: false });
  });
});

describe('open plan', () => {
  const tabs = [tab('a'), tab('b', { active: true }), tab('p', { pinned: true })];

  it('replace all: reuses the active tab and closes the rest, except pinned tabs', () => {
    expect(planOpen(tabs, 'Home.md', 'replace-all', 'switch')).toEqual({ action: 'open', leaf: 'b', close: ['a'] });
  });

  it('replace all with a pinned active tab reuses the first unpinned one', () => {
    const t = [tab('p', { pinned: true, active: true }), tab('a'), tab('b')];
    expect(planOpen(t, 'Home.md', 'replace-all', 'switch')).toEqual({ action: 'open', leaf: 'a', close: ['b'] });
  });

  it('replace last: reuses only the active tab, or a new tab when it is pinned', () => {
    expect(planOpen(tabs, 'Home.md', 'replace-last', 'switch')).toEqual({ action: 'open', leaf: 'b', close: [] });
    const t = [tab('a'), tab('p', { pinned: true, active: true })];
    expect(planOpen(t, 'Home.md', 'replace-last', 'switch')).toEqual({ action: 'open', leaf: null, close: [] });
  });

  it('keep: opens a new tab, unless the active tab is empty', () => {
    expect(planOpen(tabs, 'Home.md', 'keep', 'switch')).toEqual({ action: 'open', leaf: null, close: [] });
    const t = [tab('a'), tab('e', { path: null, empty: true, active: true })];
    expect(planOpen(t, 'Home.md', 'keep', 'switch')).toEqual({ action: 'open', leaf: 'e', close: [] });
  });

  it('when the homepage is already open: switch, reload, or open another copy', () => {
    const t = [tab('a', { active: true }), tab('Home')];
    expect(planOpen(t, 'Home.md', 'keep', 'switch')).toEqual({ action: 'focus', leaf: 'Home', close: [] });
    expect(planOpen(t, 'Home.md', 'keep', 'reload')).toEqual({ action: 'reload', leaf: 'Home', close: [] });
    expect(planOpen(t, 'Home.md', 'replace-all', 'switch')).toEqual({ action: 'focus', leaf: 'Home', close: ['a'] });
    expect(planOpen(t, 'Home.md', 'keep', 'duplicate')).toEqual({ action: 'open', leaf: null, close: [] });
  });

  it('with no tabs at all opens a new one', () => {
    expect(planOpen([], 'Home.md', 'replace-all', 'switch')).toEqual({ action: 'open', leaf: null, close: [] });
  });
});

describe('settings', () => {
  it('fills defaults and drops invalid values', () => {
    expect(readSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(readSettings({ kind: 'graph', openMode: 'keep', view: 'reading', openOnStartup: 'yes', target: 'Start' })).toEqual({
      ...DEFAULT_SETTINGS,
      openMode: 'keep',
      view: 'reading',
      target: 'Start',
    });
  });

  it('maps the view setting to an open state', () => {
    expect(openStateFor('default')).toEqual({});
    expect(openStateFor('reading')).toEqual({ state: { mode: 'preview' } });
    expect(openStateFor('editing')).toEqual({ state: { mode: 'source' } });
  });
});
