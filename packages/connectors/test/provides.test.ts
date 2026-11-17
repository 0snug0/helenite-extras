import { readFileSync } from 'node:fs';
import { afterAll, describe, expect, it } from 'vitest';
import { letterboxd, radarr, sabnzbd, sonarr } from '../src';
import { toDownload } from '../src/connectors/sabnzbd';
import { toLibrary as radarrLibrary } from '../src/connectors/radarr';
import { toLibrary as sonarrLibrary } from '../src/connectors/sonarr';
import { parseContract, validate, type Contract } from '../src/data';
import { KEYS, letterboxdMock, makeCtx, radarrMock, sabMock, sonarrMock, type Mock } from './mocks';

const open: Mock[] = [];
const track = async (p: Promise<Mock>) => { const m = await p; open.push(m); return m; };
afterAll(() => Promise.all(open.map((m) => m.close())));

const load = (name: string): Contract => {
  const r = parseContract(name, readFileSync(new URL(`../contracts/${name}.json`, import.meta.url), 'utf8'));
  if ('error' in r) throw new Error(r.error);
  return r.contract;
};
const contracts = { 'download-queue': load('download-queue'), library: load('library'), watchlist: load('watchlist') };
const expectValid = (records: unknown[], name: keyof typeof contracts) => {
  expect(records.length).toBeGreaterThan(0);
  for (const r of records) expect(validate(r, contracts[name].records)).toEqual([]);
};

describe('reference contract files', () => {
  it('parse, and declare the documented actions', () => {
    expect(Object.keys(contracts['download-queue'].actions)).toEqual(['pause', 'resume', 'remove']);
    expect(contracts['download-queue'].actions.remove.args).toEqual([{ type: 'boolean' }]);
    expect(contracts.library.actions).toEqual({});
    expect(contracts.watchlist.actions).toEqual({});
  });
  it('reject malformed records', () => {
    expect(validate({ id: 'a', name: 'x', status: 'weird', progress: 2, sizeBytes: 1, leftBytes: 1 }, contracts['download-queue'].records)).not.toEqual([]);
    expect(validate({ id: 1, title: 't', kind: 'movie', monitored: true, hasFile: false, year: 1995.5 }, contracts.library.records)).not.toEqual([]);
    expect(validate({ id: 'a', title: 't', link: 'https://example.com/x' }, contracts.watchlist.records)).not.toEqual([]);
  });
});

describe('every provides method exists on the client', () => {
  const ctx = makeCtx({ secrets: {}, bindings: {}, settings: {} });
  for (const def of [sabnzbd, radarr, sonarr, letterboxd]) {
    it(def.id, () => {
      const client = def.client(ctx) as Record<string, unknown>;
      const entries = Object.entries(def.provides ?? {});
      expect(entries.length).toBeGreaterThan(0);
      for (const [name, spec] of entries) {
        expect(name in contracts).toBe(true);
        for (const method of [spec.list, ...Object.values(spec.actions ?? {})]) expect(typeof client[method as string]).toBe('function');
        for (const action of Object.keys(spec.actions ?? {})) expect(action in contracts[name as keyof typeof contracts].actions).toBe(true);
      }
    });
  }
});

describe('sabnzbd → download-queue', () => {
  const sabCtx = (mock: Mock, calls?: any[]) => makeCtx({ secrets: { SABNZBD_API_KEY: KEYS.sab }, bindings: { SABNZBD_API_KEY: 'http://localhost:8080' }, rewrite: { 'http://localhost:8080': mock.origin }, settings: { SABNZBD_URL: 'http://localhost:8080' }, calls });
  it('maps a slot', () => {
    expect(toDownload({ nzo_id: 'a', filename: 'x', status: 'Downloading', mb: '100', mbleft: '25' })).toEqual({ id: 'a', name: 'x', status: 'downloading', progress: 0.75, sizeBytes: 104857600, leftBytes: 26214400 });
  });
  it('maps statuses, eta, and a zero-size slot', () => {
    const st = (status: string) => toDownload({ nzo_id: 'a', filename: 'x', status, mb: '10', mbleft: '10' }).status;
    expect(['Paused', 'Queued', 'Grabbing', 'Fetching', 'Propagating', 'Completed', 'Failed', 'Downloading', 'Verifying'].map(st)).toEqual(['paused', 'queued', 'queued', 'queued', 'queued', 'completed', 'failed', 'downloading', 'downloading']);
    expect(toDownload({ nzo_id: 'a', filename: 'x', status: 'Downloading', mb: '0', mbleft: '0', timeleft: '1:02:03' })).toMatchObject({ progress: 0, sizeBytes: 0, etaSeconds: 3723 });
    expect(toDownload({ nzo_id: 'a', filename: 'x', status: 'Downloading', mb: '1', mbleft: '1', timeleft: '0:00:00' }).etaSeconds).toBe(0);
    expect('etaSeconds' in toDownload({ nzo_id: 'a', filename: 'x', status: 'Paused', mb: '1', mbleft: '1' })).toBe(false);
  });
  it('listQueue returns valid records', async () => {
    const mock = await track(sabMock());
    expectValid(await sabnzbd.client(sabCtx(mock)).listQueue(), 'download-queue');
  });
  it('pause/resume/remove issue the same requests as the job methods', async () => {
    const mock = await track(sabMock());
    const calls: any[] = [];
    const c = sabnzbd.client(sabCtx(mock, calls));
    await c.pauseJob('a'); await c.pauseRecord({ id: 'a' });
    await c.resumeJob('a'); await c.resumeRecord({ id: 'a' });
    await c.deleteJob('a', true); await c.removeRecord({ id: 'a' }, true);
    await c.deleteJob('a', false); await c.removeRecord({ id: 'a' }, false);
    expect(calls).toHaveLength(8);
    for (let i = 0; i < 8; i += 2) expect(calls[i + 1]).toEqual(calls[i]);
    expect(mock.hits[7].url).toContain('del_files=0');
  });
});

describe('radarr / sonarr → library', () => {
  it('radarr listLibrary returns valid records', async () => {
    const mock = await track(radarrMock());
    const ctx = makeCtx({ secrets: { RADARR_API_KEY: KEYS.radarr }, bindings: { RADARR_API_KEY: 'http://localhost:7878' }, rewrite: { 'http://localhost:7878': mock.origin }, settings: { RADARR_URL: 'http://localhost:7878' } });
    const recs = await radarr.client(ctx).listLibrary();
    expectValid(recs, 'library');
    expect(recs).toEqual([{ id: '3', title: 'Heat', kind: 'movie', monitored: false, hasFile: false }]);
  });
  it('sonarr listLibrary returns valid records', async () => {
    const mock = await track(sonarrMock());
    const ctx = makeCtx({ secrets: { SONARR_API_KEY: KEYS.sonarr }, bindings: { SONARR_API_KEY: 'http://localhost:8989' }, rewrite: { 'http://localhost:8989': mock.origin }, settings: { SONARR_URL: 'http://localhost:8989' } });
    const recs = await sonarr.client(ctx).listLibrary();
    expectValid(recs, 'library');
    expect(recs[0]).toMatchObject({ id: '2', kind: 'show' });
  });
  it('maps year, tmdbId and hasFile', () => {
    expect(radarrLibrary({ id: 1, title: 'A', monitored: true, hasFile: true, year: 1995, tmdbId: 949 })).toEqual({ id: '1', title: 'A', kind: 'movie', monitored: true, hasFile: true, year: 1995, tmdbId: 949 });
    expect(radarrLibrary({ id: 1, title: 'A', year: 0.5, tmdbId: '9' })).not.toHaveProperty('year');
    expect(radarrLibrary({ id: 1, title: 'A', year: 0.5, tmdbId: '9' })).not.toHaveProperty('tmdbId');
    expect(sonarrLibrary({ id: 2, title: 'S', monitored: true, statistics: { episodeFileCount: 3 } }).hasFile).toBe(true);
    expect(sonarrLibrary({ id: 2, title: 'S', statistics: { episodeFileCount: 0 } }).hasFile).toBe(false);
    expect(sonarrLibrary({ id: 2, title: 'S' }).hasFile).toBe(false);
  });
});

describe('letterboxd → watchlist', () => {
  it('listWatchlist returns valid records keyed by slug', async () => {
    const mock = await track(letterboxdMock());
    const ctx = makeCtx({ secrets: {}, bindings: {}, rewrite: { 'https://letterboxd.com': mock.origin }, settings: { LETTERBOXD_USER: 'me' } });
    const recs = await letterboxd.client(ctx).listWatchlist();
    expectValid(recs, 'watchlist');
    expect(recs[0]).toEqual({ id: 'heat-1995', title: 'Heat', link: 'https://letterboxd.com/film/heat-1995/' });
  });
});
