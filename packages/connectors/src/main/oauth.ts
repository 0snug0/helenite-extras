// OAuth 2.0 authorization-code + PKCE with a loopback redirect (RFC 8252). Runs in the main process only.
import { createHash, randomBytes } from 'node:crypto';
import http from 'node:http';
import type { AddressInfo } from 'node:net';

const b64url = (b: Buffer) => b.toString('base64url');
export const createPkce = () => {
  const verifier = b64url(randomBytes(48));
  return { verifier, challenge: b64url(createHash('sha256').update(verifier).digest()), state: b64url(randomBytes(16)) };
};

export function buildAuthUrl(o: { authEndpoint: string; clientId: string; redirectUri: string; scope: string; state: string; challenge: string; extra?: Record<string, string> }): string {
  const u = new URL(o.authEndpoint);
  const p = { response_type: 'code', client_id: o.clientId, redirect_uri: o.redirectUri, scope: o.scope, state: o.state, code_challenge: o.challenge, code_challenge_method: 'S256', ...o.extra };
  for (const [k, v] of Object.entries(p)) u.searchParams.set(k, v);
  return u.href;
}

export interface LoopbackServer { redirectUri: string; code: Promise<string>; close(): void }

/** Listen on 127.0.0.1:<random>, resolve with the code once the browser lands on /callback with the right state. */
export async function startLoopback(expectedState: string, timeoutMs = 5 * 60_000): Promise<LoopbackServer> {
  let resolve!: (c: string) => void, reject!: (e: Error) => void;
  const code = new Promise<string>((res, rej) => { resolve = res; reject = rej; });
  code.catch(() => {});
  const server = http.createServer((req, res) => {
    const u = new URL(req.url ?? '/', 'http://127.0.0.1');
    if (u.pathname !== '/callback') { res.writeHead(404).end(); return; }
    const err = u.searchParams.get('error');
    const ok = !err && u.searchParams.get('state') === expectedState && !!u.searchParams.get('code');
    res.writeHead(ok ? 200 : 400, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(ok ? '<p>Connected. You can close this tab and return to Helenite.</p>' : '<p>Authorization failed. Return to Helenite and try again.</p>');
    if (ok) resolve(u.searchParams.get('code')!);
    else reject(new Error(err ? `authorization denied: ${err}` : 'state mismatch'));
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const timer = setTimeout(() => reject(new Error('authorization timed out')), timeoutMs);
  timer.unref();
  const close = () => { clearTimeout(timer); server.close(); server.closeAllConnections?.(); };
  code.then(close, close);
  return { redirectUri: `http://127.0.0.1:${(server.address() as AddressInfo).port}/callback`, code, close };
}

/** Token endpoint failure; `code` is the OAuth `error` field (e.g. `invalid_grant`). */
export class TokenError extends Error {
  constructor(public status: number, public code?: string) { super(`token endpoint: HTTP ${status}${code ? ` ${code}` : ''}`); this.name = 'TokenError'; }
}

export interface TokenSet { accessToken: string; refreshToken?: string; expiresAt: number }
type FetchLike = typeof fetch;

async function tokenRequest(endpoint: string, params: Record<string, string>, fetchImpl: FetchLike, now: () => number): Promise<TokenSet> {
  const res = await fetchImpl(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(params) });
  const text = await res.text();
  let j: any = {};
  try { j = JSON.parse(text); } catch { /* handled below */ }
  if (!res.ok || !j.access_token) throw new TokenError(res.status, typeof j.error === 'string' ? j.error : undefined);
  return { accessToken: j.access_token, refreshToken: j.refresh_token, expiresAt: now() + (Number(j.expires_in) || 3600) * 1000 };
}

export const exchangeCode = (o: { tokenEndpoint: string; clientId: string; clientSecret?: string; code: string; verifier: string; redirectUri: string; fetchImpl?: FetchLike; now?: () => number }) =>
  tokenRequest(o.tokenEndpoint, { grant_type: 'authorization_code', code: o.code, client_id: o.clientId, redirect_uri: o.redirectUri, code_verifier: o.verifier, ...(o.clientSecret ? { client_secret: o.clientSecret } : {}) }, o.fetchImpl ?? fetch, o.now ?? Date.now);

export const refreshAccessToken = (o: { tokenEndpoint: string; clientId: string; clientSecret?: string; refreshToken: string; fetchImpl?: FetchLike; now?: () => number }) =>
  tokenRequest(o.tokenEndpoint, { grant_type: 'refresh_token', refresh_token: o.refreshToken, client_id: o.clientId, ...(o.clientSecret ? { client_secret: o.clientSecret } : {}) }, o.fetchImpl ?? fetch, o.now ?? Date.now);
