import { mkdtempSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { appScope, connectorScope, createConnectorHost, createFakeSafeStorage, createGoogleAuth, createSecretStore, resolveSecret, startLoopback } from '../src/main';
import { googleCalendar } from '../src';
import { googleMock, makeCtx, type Mock } from './mocks';

const dir = () => mkdtempSync(join(tmpdir(), 'helenite-secrets-'));
const closers: Mock[] = [];
afterAll(() => Promise.all(closers.map((m) => m.close())));

describe('secret store', () => {
  it('encrypts at rest (0600), lists names only, resolves app then connector scope', async () => {
    const d = dir();
    const s = createSecretStore({ userDataDir: d, safeStorage: createFakeSafeStorage() });
    await s.ready;
    s.set(appScope('dl'), 'RADARR_API_KEY', 'hunter2');
    s.set(connectorScope('google-calendar'), 'GCAL_ACCESS_TOKEN', 'tok');
    expect(s.get(appScope('dl'), 'RADARR_API_KEY')).toBe('hunter2');
    expect(s.names(appScope('dl'))).toEqual(['RADARR_API_KEY']);
    await s.flush();
    expect(statSync(join(d, 'secrets.json')).mode & 0o777).toBe(0o600);
    expect(readFileSync(join(d, 'secrets.json'), 'utf8')).not.toContain('hunter2');
    expect(resolveSecret(s, 'dl', 'RADARR_API_KEY')).toBe('hunter2');
    expect(resolveSecret(s, 'other', 'GCAL_ACCESS_TOKEN', ['google-calendar'])).toBe('tok');
    expect(resolveSecret(s, 'other', 'GCAL_ACCESS_TOKEN', [])).toBeNull();
    expect(resolveSecret(s, 'other', 'RADARR_API_KEY', ['google-calendar'])).toBeNull();
    s.delete(appScope('dl'), 'RADARR_API_KEY');
    expect(s.has(appScope('dl'), 'RADARR_API_KEY')).toBe(false);
    await s.flush();
    const reopened = createSecretStore({ userDataDir: d, safeStorage: createFakeSafeStorage() });
    await reopened.ready;
    expect(reopened.has(appScope('dl'), 'RADARR_API_KEY')).toBe(false);
    expect(reopened.get(connectorScope('google-calendar'), 'GCAL_ACCESS_TOKEN')).toBe('tok');
  });
  it('keeps the last of rapid writes, in call order', async () => {
    const d = dir();
    const s = createSecretStore({ userDataDir: d, safeStorage: createFakeSafeStorage() });
    await s.ready;
    s.set('a', 'K', 'one');
    s.set('a', 'K', 'two');
    s.set('a', 'L', 'x');
    s.delete('a', 'L');
    await s.flush();
    const reopened = createSecretStore({ userDataDir: d, safeStorage: createFakeSafeStorage() });
    await reopened.ready;
    expect(reopened.get('a', 'K')).toBe('two');
    expect(reopened.names('a')).toEqual(['K']);
  });
  it('refuses to write when the keychain is unavailable', async () => {
    const s = createSecretStore({ userDataDir: dir(), safeStorage: { ...createFakeSafeStorage(), isAsyncEncryptionAvailable: async () => false } });
    await s.ready;
    expect(s.backend).toBe('unavailable');
    expect(() => s.set('a', 'B', 'x')).toThrow(/not available/);
  });
});

describe('google-calendar OAuth against a mock server', () => {
  async function setup(clock = { t: 1_000_000 }) {
    const { mock, state } = await googleMock();
    closers.push(mock);
    const secrets = createSecretStore({ userDataDir: dir(), safeStorage: createFakeSafeStorage() });
    await secrets.ready;
    const scope = connectorScope('google-calendar');
    secrets.set(scope, 'GCAL_CLIENT_ID', 'client-1');
    const opened: string[] = [];
    const auth = createGoogleAuth({
      secrets, now: () => clock.t, endpoints: { auth: `${mock.origin}/auth`, token: `${mock.origin}/token` },
      // The "browser": follow the consent URL; the mock redirects to our loopback with code+state.
      openUrl: async (url) => { opened.push(url); void fetch(url).then((r) => r.text()); },
    });
    return { mock, state, secrets, scope, auth, opened, clock };
  }

  it('connect stores tokens in the keychain; PKCE + state are sent; ensureAccessToken refreshes when expired', async () => {
    const { state, secrets, scope, auth, opened, clock } = await setup();
    expect(auth.status()).toEqual({ connected: false, hasClientId: true });
    await expect(auth.ensureAccessToken()).rejects.toThrow(/not connected/);
    await auth.connect(5000);
    const u = new URL(opened[0]);
    expect(u.searchParams.get('code_challenge_method')).toBe('S256');
    expect(u.searchParams.get('scope')).toContain('calendar.readonly');
    expect(u.searchParams.get('redirect_uri')).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/callback$/);
    expect(secrets.get(scope, 'GCAL_ACCESS_TOKEN')).toBe('access-1');
    expect(secrets.get(scope, 'GCAL_REFRESH_TOKEN')).toBe('refresh-1');
    await auth.ensureAccessToken();
    expect(state.refreshes).toBe(0);              // still fresh
    clock.t += 3600_000;
    await auth.ensureAccessToken();
    expect(state.refreshes).toBe(1);
    expect(secrets.get(scope, 'GCAL_ACCESS_TOKEN')).toBe('access-2');
    auth.disconnect();
    expect(auth.status().connected).toBe(false);
    expect(secrets.has(scope, 'GCAL_ACCESS_TOKEN')).toBe(false);
  });

  it('connector lists events through ensureAuth, with the host-held token', async () => {
    const { mock, secrets, scope, auth } = await setup();
    await auth.connect(5000);
    const host = createConnectorHost({ secrets, googleAuth: auth });
    const bag: Record<string, string> = { GCAL_ACCESS_TOKEN: secrets.get(scope, 'GCAL_ACCESS_TOKEN')! };
    const ctx = makeCtx({ secrets: bag, bindings: { GCAL_ACCESS_TOKEN: 'https://www.googleapis.com' }, rewrite: { 'https://www.googleapis.com': mock.origin }, ensureAuth: async (id) => { await host.ensureAuth(id); bag.GCAL_ACCESS_TOKEN = secrets.get(scope, 'GCAL_ACCESS_TOKEN')!; } });
    const c = googleCalendar.client(ctx);
    expect((await c.listCalendars())[0]).toEqual({ id: 'primary', summary: 'Eric', primary: true });
    const ev = await c.listEvents({ timeMin: '2026-11-10T00:00:00Z', timeMax: '2026-11-12T00:00:00Z' });
    expect(ev.map((e) => [e.id, e.summary, e.allDay])).toEqual([['e1', 'Standup', false], ['e2', '(no title)', true]]);
  });

  it('rejects a mismatched state and a missing client id', async () => {
    const lb = await startLoopback('good', 5000);
    const bad = await fetch(`${lb.redirectUri}?code=c&state=evil`);
    expect(bad.status).toBe(400);
    await expect(lb.code).rejects.toThrow(/state mismatch/);
    const { auth, secrets, scope } = await setup();
    secrets.delete(scope, 'GCAL_CLIENT_ID');
    await expect(auth.connect(1000)).rejects.toThrow(/client ID/);
  });

  it('times out when the user never approves, and surfaces a revoked refresh token', async () => {
    const { state, secrets, scope, auth, clock } = await setup();
    const slow = createGoogleAuth({ secrets, openUrl: () => {}, endpoints: { auth: 'http://127.0.0.1:1/auth', token: 'http://127.0.0.1:1/token' } });
    await expect(slow.connect(50)).rejects.toThrow(/timed out/);
    await auth.connect(5000);
    state.badRefresh = true; clock.t += 7200_000;
    await expect(auth.ensureAccessToken()).rejects.toThrow(/invalid_grant/);
  });
});

describe('ConnectorHost for the app runtime (R contract)', () => {
  it('describes methods and invokes with a per-call, brokered ctx', async () => {
    const { createConnectorRegistryHost } = await import('../src/main');
    const { radarrMock, makeCtx, KEYS } = await import('./mocks');
    const mock = await radarrMock(); closers.push(mock);
    const seen: string[] = [];
    const host = createConnectorRegistryHost({ ctxFor: (c) => { seen.push(`${c.appId}:${c.connectorId}`); return makeCtx({ secrets: { RADARR_API_KEY: KEYS.radarr }, bindings: { RADARR_API_KEY: 'http://localhost:7878' }, rewrite: { 'http://localhost:7878': mock.origin }, settings: { RADARR_URL: 'http://localhost:7878' } }); } });
    expect(host.has('radarr')).toBe(true);
    expect(host.has('nope')).toBe(false);
    expect(host.describe('radarr')!.methods).toContain('getQueue');
    expect((await host.invoke({ appId: 'dl', connectorId: 'radarr', method: 'getQueue', args: [], vaultRoot: '/v' }) as any[])[0].id).toBe(7);
    expect(seen).toEqual(['dl:radarr']);
    await expect(host.invoke({ appId: 'dl', connectorId: 'radarr', method: 'nope', args: [], vaultRoot: '/v' })).rejects.toMatchObject({ code: 'unknown-method' });
    await expect(host.invoke({ appId: 'dl', connectorId: 'zzz', method: 'x', args: [], vaultRoot: '/v' })).rejects.toMatchObject({ code: 'unavailable' });
  });
});
