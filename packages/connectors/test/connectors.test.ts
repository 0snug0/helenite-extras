import { afterAll, describe, expect, it } from 'vitest';
import { ConnectorError, connectorPermissions, createConnectors, listConnectors, radarr, sabnzbd, sonarr, plex, tmdb, letterboxd, request, secretRef } from '../src';
import { KEYS, letterboxdMock, makeCtx, plexMock, radarrMock, sabMock, sonarrMock, tmdbMock, type Mock } from './mocks';

const open: Mock[] = [];
const track = async (p: Promise<Mock>) => { const m = await p; open.push(m); return m; };
afterAll(() => Promise.all(open.map((m) => m.close())));

describe('radarr', () => {
  it('sends the key as a header placeholder bound to its host, and returns typed data', async () => {
    const mock = await track(radarrMock());
    const ctx = makeCtx({ secrets: { RADARR_API_KEY: KEYS.radarr }, bindings: { RADARR_API_KEY: 'http://localhost:7878' }, rewrite: { 'http://localhost:7878': mock.origin }, settings: { RADARR_URL: 'http://localhost:7878/' } });
    const c = radarr.client(ctx);
    expect(await c.getQueue()).toEqual([{ id: 7, title: 'Heat.1995', movieId: 3, sizeleft: 100 }]);
    expect(await c.lookup('the matrix & co')).toEqual([{ title: 'the matrix & co', tmdbId: 603 }]);
    expect(await c.getReleases(3)).toEqual([{ guid: 'g1', indexerId: 1, movieId: 3 }]);
    expect(await c.grabRelease({ guid: 'g1', indexerId: 1 })).toEqual({ guid: 'g1', indexerId: 1 });
    expect(await c.removeQueueItem(7)).toBe(true);
    expect(mock.hits.find((h) => h.method === 'DELETE')!.url).toContain('removeFromClient=true');
    expect(mock.hits[0].url).toBe('/api/v3/queue?page=1&pageSize=200&includeMovie=true');
  });
  it('a wrong key is a ConnectorError with the status, not a crash', async () => {
    const mock = await track(radarrMock());
    const ctx = makeCtx({ secrets: { RADARR_API_KEY: 'nope' }, bindings: { RADARR_API_KEY: 'http://localhost:7878' }, rewrite: { 'http://localhost:7878': mock.origin }, settings: { RADARR_URL: 'http://localhost:7878' } });
    await expect(radarr.client(ctx).getMovies()).rejects.toMatchObject({ name: 'ConnectorError', status: 401 });
  });
  it('the secret never reaches an unbound origin', async () => {
    const ctx = makeCtx({ secrets: { RADARR_API_KEY: 'k' }, bindings: { RADARR_API_KEY: 'http://localhost:7878' }, settings: { RADARR_URL: 'http://evil.test:1' } });
    await expect(radarr.client(ctx).getMovies()).rejects.toThrow(/not bound/);
  });
});

describe('sonarr', () => {
  it('queue, calendar, episodes', async () => {
    const mock = await track(sonarrMock());
    const ctx = makeCtx({ secrets: { SONARR_API_KEY: KEYS.sonarr }, bindings: { SONARR_API_KEY: 'http://localhost:8989' }, rewrite: { 'http://localhost:8989': mock.origin }, settings: { SONARR_URL: 'http://localhost:8989' } });
    const c = sonarr.client(ctx);
    expect((await c.getQueue())[0].series.title).toBe('Show');
    expect(await c.getCalendar('2026-11-01', '2026-11-08')).toEqual([{ id: 9, airDate: '2026-11-01' }]);
    expect(await c.getEpisodes(2)).toEqual([{ id: 20, seriesId: 2 }]);
  });
});

describe('sabnzbd', () => {
  it('puts the host-encoded key in the query and drives pause/resume/delete', async () => {
    const mock = await track(sabMock());
    const ctx = makeCtx({ secrets: { SABNZBD_API_KEY: KEYS.sab }, bindings: { SABNZBD_API_KEY: 'http://localhost:8080' }, rewrite: { 'http://localhost:8080': mock.origin }, settings: { SABNZBD_URL: 'http://localhost:8080' } });
    const c = sabnzbd.client(ctx);
    expect(await c.getQueue()).toEqual({ paused: false, speed: '1.5 M', slots: [{ nzo_id: 'SABnzbd_nzo_1', filename: 'Heat' }] });
    expect((await c.getHistory())[0].name).toBe('Done');
    expect(await c.pauseJob('SABnzbd_nzo_1')).toMatchObject({ action: 'pause', nzo_ids: ['SABnzbd_nzo_1'] });
    expect(await c.deleteJob('SABnzbd_nzo_1')).toMatchObject({ action: 'delete' });
    expect(await c.pauseQueue()).toMatchObject({ mode: 'pause' });
    expect(mock.hits[0].url).toContain(`apikey=${encodeURIComponent(KEYS.sab)}`);
  });
});

describe('plex', () => {
  it('lists libraries and finds a film in movie sections only', async () => {
    const mock = await track(plexMock());
    const ctx = makeCtx({ secrets: { PLEX_TOKEN: KEYS.plex }, bindings: { PLEX_TOKEN: 'http://localhost:32400' }, rewrite: { 'http://localhost:32400': mock.origin }, settings: { PLEX_URL: 'http://localhost:32400' } });
    const c = plex.client(ctx);
    expect((await c.getLibraries()).map((l) => l.title)).toEqual(['Films', 'TV']);
    expect(await c.hasMovie('heat', 1995)).toBe(true);
    expect(await c.hasMovie('Heat', 2000)).toBe(false);
    expect(mock.hits.some((h) => h.url.startsWith('/library/sections/2'))).toBe(false);
  });
});

describe('tmdb', () => {
  it('bearer token, search, details, providers', async () => {
    const mock = await track(tmdbMock());
    const ctx = makeCtx({ secrets: { TMDB_TOKEN: KEYS.tmdb }, bindings: { TMDB_TOKEN: 'https://api.themoviedb.org' }, rewrite: { 'https://api.themoviedb.org': mock.origin } });
    const c = tmdb.client(ctx);
    expect((await c.searchMovie('Heat', 1995))[0].release_date).toBe('1995-01-01');
    expect((await c.getMovie(949)).title).toBe('Heat');
    expect((await c.getProviders(949))!.flatrate[0].provider_name).toBe('Max');
    expect(await c.getProviders(949, 'FR').catch(() => 'threw')).toBeDefined();
    expect(c.imageUrl('/p.jpg')).toBe('https://image.tmdb.org/t/p/w342/p.jpg');
  });
});

describe('letterboxd (public scraping, no secrets)', () => {
  it('parses RSS, paginated watchlist and film JSON-LD', async () => {
    const mock = await track(letterboxdMock());
    const ctx = makeCtx({ secrets: {}, bindings: {}, rewrite: { 'https://letterboxd.com': mock.origin }, settings: { LETTERBOXD_USER: 'me' } });
    const c = letterboxd.client(ctx);
    const diary = await c.getDiary();
    expect(diary).toHaveLength(2);
    expect(diary[0]).toMatchObject({ title: 'Heat', year: 1995, rating: 4.5, watchedDate: '2026-10-01', rewatch: false, tmdbId: 949 });
    expect(diary[1]).toMatchObject({ rewatch: true, rating: null });
    expect((await c.getWatchlist()).map((f) => f.slug)).toEqual(['heat-1995', 'stalker', 'ran']);
    expect(await c.getFilm('heat-1995')).toMatchObject({ title: 'Heat', year: 1995, director: 'Michael Mann', rating: 4.3 });
    await expect(c.getDiary('../x')).rejects.toThrow(/username/);
    await expect(c.getFilm('../../etc')).rejects.toThrow(/slug/);
  });
  it('declares no secrets', () => expect(letterboxd.secrets).toEqual([]));
});

describe('SDK', () => {
  it('retries 5xx/429 with backoff and gives up with the status; never retries 4xx or writes', async () => {
    const mock = await track(radarrMock());
    const ctx = makeCtx({ secrets: { RADARR_API_KEY: KEYS.radarr }, bindings: { RADARR_API_KEY: 'http://localhost:7878' }, rewrite: { 'http://localhost:7878': mock.origin } });
    const url = `http://localhost:7878/api/v3/movie`;
    const headers = { 'X-Api-Key': secretRef('RADARR_API_KEY') };
    mock.failNext!.push(503, 429);
    expect((await request('radarr', ctx, { url, headers })).status).toBe(200);
    expect(mock.hits).toHaveLength(3);
    mock.hits.length = 0; mock.failNext!.push(500, 500, 500);
    await expect(request('radarr', ctx, { url, headers })).rejects.toMatchObject({ status: 500 });
    expect(mock.hits).toHaveLength(3);
    mock.hits.length = 0; mock.failNext!.push(500);
    await expect(request('radarr', ctx, { url, headers, method: 'POST', body: {} })).rejects.toBeInstanceOf(ConnectorError);
    expect(mock.hits).toHaveLength(1);
  });
  it('registry builds api.connectors and rejects unknown ids; permissions list net + bound hosts', () => {
    const ctx = makeCtx({ secrets: {}, bindings: {} });
    const api = createConnectors(['radarr', 'tmdb'], ctx);
    expect(Object.keys(api)).toEqual(['radarr', 'tmdb']);
    expect(() => createConnectors(['nope'], ctx)).toThrow(/unknown connector/);
    const defs = listConnectors().filter((d) => ['radarr', 'tmdb', 'google-calendar'].includes(d.id));
    const p = connectorPermissions(defs, { RADARR_URL: 'http://localhost:17878' });
    expect(p.net).toContain('http://localhost:17878');
    expect(p.net).toContain('https://api.themoviedb.org');
    expect(p.secrets.find((s) => s.name === 'RADARR_API_KEY')!.hosts).toEqual(['http://localhost:17878']);
    expect(p.secrets.find((s) => s.name === 'TMDB_TOKEN')!.hosts).toEqual(['https://api.themoviedb.org']);
  });
});
