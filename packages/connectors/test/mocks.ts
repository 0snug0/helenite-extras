// Mock services on ephemeral ports (no real service, no .env). Keys are fake. Shapes follow the spike's mock server.
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { createHash } from 'node:crypto';
import type { ConnectorContext, NetRequest } from '../src/sdk';

export const KEYS = { radarr: 'rad key/1', sonarr: 'son-key', sab: 'sab+key=', plex: 'plex-token', tmdb: 'tmdb.jwt.token' };

export interface Mock { origin: string; hits: { method: string; url: string; headers: http.IncomingHttpHeaders; body: string }[]; close(): Promise<void>; failNext?: number[] }

export async function serve(handler: (req: http.IncomingMessage, res: http.ServerResponse, body: string, mock: Mock) => void): Promise<Mock> {
  const mock: Mock = { origin: '', hits: [], close: async () => {}, failNext: [] };
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      mock.hits.push({ method: req.method ?? '', url: req.url ?? '', headers: req.headers, body });
      const fail = mock.failNext!.shift();
      if (fail) { res.writeHead(fail).end('fail'); return; }
      handler(req, res, body, mock);
    });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  mock.origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  mock.close = () => new Promise((r) => { server.closeAllConnections(); server.close(() => r()); });
  return mock;
}

export const json = (res: http.ServerResponse, status: number, body: unknown) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };

export const radarrMock = () => serve((req, res, body) => {
  if (req.headers['x-api-key'] !== KEYS.radarr) return json(res, 401, { error: 'Unauthorized' });
  const u = new URL(req.url!, 'http://x');
  if (u.pathname === '/api/v3/queue' && req.method === 'GET') return json(res, 200, { page: 1, records: [{ id: 7, title: 'Heat.1995', movieId: 3, sizeleft: 100 }] });
  if (u.pathname === '/api/v3/queue/7' && req.method === 'DELETE') { res.writeHead(200).end(); return; }
  if (u.pathname === '/api/v3/movie/lookup') return json(res, 200, [{ title: u.searchParams.get('term'), tmdbId: 603 }]);
  if (u.pathname === '/api/v3/movie' && req.method === 'GET') return json(res, 200, [{ id: 3, title: 'Heat' }]);
  if (u.pathname === '/api/v3/release' && req.method === 'POST') return json(res, 200, JSON.parse(body));
  if (u.pathname === '/api/v3/release') return json(res, 200, [{ guid: 'g1', indexerId: 1, movieId: Number(u.searchParams.get('movieId')) }]);
  json(res, 404, {});
});

export const sonarrMock = () => serve((req, res) => {
  if (req.headers['x-api-key'] !== KEYS.sonarr) return json(res, 401, {});
  const u = new URL(req.url!, 'http://x');
  if (u.pathname === '/api/v3/queue') return json(res, 200, { records: [{ id: 1, series: { title: 'Show' }, episode: { seasonNumber: 1, episodeNumber: 2 } }] });
  if (u.pathname === '/api/v3/calendar') return json(res, 200, [{ id: 9, airDate: u.searchParams.get('start') }]);
  if (u.pathname === '/api/v3/series') return json(res, 200, [{ id: 2, title: 'Show' }]);
  if (u.pathname === '/api/v3/episode') return json(res, 200, [{ id: 20, seriesId: Number(u.searchParams.get('seriesId')) }]);
  json(res, 404, {});
});

export const sabMock = () => serve((req, res) => {
  const u = new URL(req.url!, 'http://x');
  if (u.pathname !== '/api' || u.searchParams.get('apikey') !== KEYS.sab) return json(res, 200, { status: false, error: 'API Key Incorrect' });
  const mode = u.searchParams.get('mode');
  if (mode === 'queue' && u.searchParams.get('name')) return json(res, 200, { status: true, nzo_ids: [u.searchParams.get('value')], action: u.searchParams.get('name') });
  if (mode === 'queue') return json(res, 200, { queue: { paused: false, speed: '1.5 M', slots: [{ nzo_id: 'SABnzbd_nzo_1', filename: 'Heat' }] } });
  if (mode === 'history') return json(res, 200, { history: { slots: [{ nzo_id: 'x', name: 'Done' }] } });
  json(res, 200, { status: true, mode });
});

export const plexMock = () => serve((req, res) => {
  const u = new URL(req.url!, 'http://x');
  if (req.headers['x-plex-token'] !== KEYS.plex) { res.writeHead(401).end(); return; }
  if (u.pathname === '/library/sections') return json(res, 200, { MediaContainer: { Directory: [{ key: '1', type: 'movie', title: 'Films' }, { key: '2', type: 'show', title: 'TV' }] } });
  if (u.pathname === '/library/sections/1/all') return json(res, 200, { MediaContainer: { Metadata: [{ title: 'Heat', year: 1995 }] } });
  json(res, 404, {});
});

export const tmdbMock = () => serve((req, res) => {
  if (req.headers.authorization !== `Bearer ${KEYS.tmdb}`) return json(res, 401, { status_code: 7 });
  const u = new URL(req.url!, 'http://x');
  if (u.pathname === '/3/search/movie') return json(res, 200, { results: [{ id: 949, title: u.searchParams.get('query'), release_date: `${u.searchParams.get('year')}-01-01` }] });
  if (u.pathname === '/3/movie/949/watch/providers') return json(res, 200, { results: { US: { flatrate: [{ provider_name: 'Max' }] } } });
  if (u.pathname === '/3/movie/949') return json(res, 200, { id: 949, title: 'Heat' });
  json(res, 404, {});
});

export const LB_RSS = `<?xml version="1.0"?><rss xmlns:letterboxd="x" xmlns:tmdb="y"><channel>
<item><title>Heat, 1995 - ★★★★½</title><link>https://letterboxd.com/me/film/heat-1995/</link><letterboxd:watchedDate>2026-10-01</letterboxd:watchedDate><letterboxd:rewatch>No</letterboxd:rewatch><letterboxd:filmTitle>Heat</letterboxd:filmTitle><letterboxd:filmYear>1995</letterboxd:filmYear><letterboxd:memberRating>4.5</letterboxd:memberRating><tmdb:movieId>949</tmdb:movieId></item>
<item><title>Amélie &amp; Co, 2001</title><link>https://letterboxd.com/me/film/amelie/</link><letterboxd:watchedDate>2026-09-02</letterboxd:watchedDate><letterboxd:rewatch>Yes</letterboxd:rewatch><letterboxd:filmTitle>Am&amp;eacute;lie</letterboxd:filmTitle><letterboxd:filmYear>2001</letterboxd:filmYear></item>
<item><title>A list, not a film</title><link>https://letterboxd.com/me/list/x/</link></item></channel></rss>`;

const poster = (slug: string, name: string) => `<li class="poster-container"><div class="react-component poster film-poster" data-film-slug="${slug}" data-film-name="${name}"></div></li>`;
export const letterboxdMock = () => serve((req, res) => {
  const u = new URL(req.url!, 'http://x');
  if (u.pathname === '/me/rss/') { res.writeHead(200, { 'Content-Type': 'application/rss+xml' }).end(LB_RSS); return; }
  const m = u.pathname.match(/^\/me\/watchlist\/page\/(\d+)\/$/);
  if (m) { const p = Number(m[1]); res.writeHead(200).end(`<ul>${p === 1 ? poster('heat-1995', 'Heat') + poster('stalker', 'Stalker') : poster('ran', 'Ran')}</ul>${p === 1 ? '<a class="next" href="#">Older</a>' : ''}`); return; }
  if (u.pathname === '/film/heat-1995/') { res.writeHead(200).end(`<html><script type="application/ld+json">/* <![CDATA[ */ {"name":"Heat","releasedEvent":[{"startDate":"1995"}],"director":[{"name":"Michael Mann"}],"aggregateRating":{"ratingValue":4.3,"ratingCount":600000}} /* ]]> */</script></html>`); return; }
  res.writeHead(404).end();
});

/** Mock Google: consent page (drives itself via `approve`), token endpoint with PKCE check and refresh, calendar API. */
export async function googleMock() {
  const state = { codes: new Map<string, { challenge: string; redirect: string }>(), tokens: 0, refreshes: 0, accessTtl: 3600, badRefresh: false };
  const mock = await serve((req, res, body) => {
    const u = new URL(req.url!, 'http://x');
    if (u.pathname === '/auth') {
      const code = `code-${state.codes.size + 1}`;
      state.codes.set(code, { challenge: u.searchParams.get('code_challenge')!, redirect: u.searchParams.get('redirect_uri')! });
      const back = new URL(u.searchParams.get('redirect_uri')!);
      back.searchParams.set('code', code); back.searchParams.set('state', u.searchParams.get('state')!);
      res.writeHead(302, { Location: back.href }).end(); return;
    }
    if (u.pathname === '/token' && req.method === 'POST') {
      const p = new URLSearchParams(body);
      if (p.get('grant_type') === 'authorization_code') {
        const c = state.codes.get(p.get('code') ?? '');
        const ok = c && c.redirect === p.get('redirect_uri') && createHash('sha256').update(p.get('code_verifier') ?? '').digest('base64url') === c.challenge;
        if (!ok) return json(res, 400, { error: 'invalid_grant' });
        state.codes.delete(p.get('code')!);
        return json(res, 200, { access_token: `access-${++state.tokens}`, refresh_token: 'refresh-1', expires_in: state.accessTtl });
      }
      if (p.get('grant_type') === 'refresh_token') {
        if (state.badRefresh || p.get('refresh_token') !== 'refresh-1') return json(res, 400, { error: 'invalid_grant' });
        state.refreshes++;
        return json(res, 200, { access_token: `access-${++state.tokens}`, expires_in: state.accessTtl });
      }
    }
    if (u.pathname === '/calendar/v3/users/me/calendarList') return authed(req, res, () => json(res, 200, { items: [{ id: 'primary', summary: 'Eric', primary: true }] }), state);
    if (u.pathname === '/calendar/v3/calendars/primary/events') return authed(req, res, () => json(res, 200, { items: [
      { id: 'e1', summary: 'Standup', start: { dateTime: '2026-11-10T09:00:00Z' }, end: { dateTime: '2026-11-10T09:15:00Z' } },
      { id: 'e2', start: { date: '2026-11-11' }, end: { date: '2026-11-12' } },
      { id: 'e3', status: 'cancelled', summary: 'x', start: { date: '2026-11-11' }, end: { date: '2026-11-12' } }] }), state);
    json(res, 404, {});
  });
  return { mock, state };
}
function authed(req: http.IncomingMessage, res: http.ServerResponse, ok: () => void, state: { tokens: number }) {
  if (req.headers.authorization === `Bearer access-${state.tokens}`) ok(); else json(res, 401, { error: 'bad token' });
}

/**
 * A stand-in for the host's net.fetch: origin allowlist, `{{secret:NAME}}` filled only for the bound origin
 * (URL-encoded in the URL, raw in headers). `rewrite` maps the real service origin to a mock.
 */
export function makeCtx(o: { secrets: Record<string, string>; bindings: Record<string, string>; rewrite?: Record<string, string>; settings?: Record<string, string>; ensureAuth?: ConnectorContext['ensureAuth']; calls?: NetRequest[] }): ConnectorContext {
  const PH = /\{\{secret:([A-Z][A-Z0-9_]*)\}\}/g;
  return {
    settings: o.settings ?? {},
    ensureAuth: o.ensureAuth,
    sleep: async () => {},
    async fetch(req) {
      o.calls?.push(req);
      const origin = new URL(req.url.replace(PH, 'x')).origin;
      const fill = (s: string, enc: boolean) => s.replace(PH, (_, n) => {
        if (o.bindings[n] !== origin) throw new Error(`secret ${n} not bound to ${origin}`);
        return enc ? encodeURIComponent(o.secrets[n]) : o.secrets[n];
      });
      const target = o.rewrite?.[origin];
      let url = fill(req.url, true);
      if (target) url = url.replace(origin, target);
      const headers = Object.fromEntries(Object.entries(req.headers ?? {}).map(([k, v]) => [k, fill(String(v), false)]));
      const res = await fetch(url, { method: req.method ?? 'GET', headers, body: req.body == null ? undefined : typeof req.body === 'string' ? req.body : JSON.stringify(req.body) });
      return { status: res.status, headers: Object.fromEntries(res.headers), text: await res.text() };
    },
  };
}
