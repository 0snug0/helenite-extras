// Google Calendar auth: loopback + PKCE, tokens in the keychain scope `connector:google-calendar`.
// The sandbox never sees the refresh token; the host refreshes the access token before a request (ensureAuth).
import { GCAL_SECRETS } from '../connectors/google-calendar';
import { buildAuthUrl, createPkce, exchangeCode, refreshAccessToken, startLoopback } from './oauth';
import { connectorScope, type SecretStore } from './secrets';

export const GOOGLE_ENDPOINTS = { auth: 'https://accounts.google.com/o/oauth2/v2/auth', token: 'https://oauth2.googleapis.com/token' };
export const GCAL_SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';
const EXPIRES = 'GCAL_ACCESS_EXPIRES';
const SKEW_MS = 60_000;

export interface GoogleAuthOptions {
  secrets: SecretStore;
  /** Opens the consent URL in the user's browser (Electron `shell.openExternal`). Tests pass a function that drives a mock. */
  openUrl(url: string): void | Promise<void>;
  endpoints?: { auth: string; token: string };
  fetchImpl?: typeof fetch;
  now?: () => number;
}

export function createGoogleAuth(o: GoogleAuthOptions) {
  const scope = connectorScope('google-calendar');
  const ep = o.endpoints ?? GOOGLE_ENDPOINTS;
  const now = o.now ?? Date.now;
  const get = (n: string) => o.secrets.get(scope, n);
  const store = (t: { accessToken: string; refreshToken?: string; expiresAt: number }) => {
    o.secrets.set(scope, GCAL_SECRETS.access, t.accessToken);
    o.secrets.set(scope, EXPIRES, String(t.expiresAt));
    if (t.refreshToken) o.secrets.set(scope, GCAL_SECRETS.refresh, t.refreshToken);
  };
  const creds = () => {
    const clientId = get(GCAL_SECRETS.clientId);
    if (!clientId) throw new Error('set the Google OAuth client ID in Settings → Secrets first');
    return { clientId, clientSecret: get(GCAL_SECRETS.clientSecret) ?? undefined };
  };

  return {
    status: () => ({ connected: o.secrets.has(scope, GCAL_SECRETS.refresh), hasClientId: o.secrets.has(scope, GCAL_SECRETS.clientId) }),
    /** Interactive consent. Resolves once tokens are stored. */
    async connect(timeoutMs?: number): Promise<void> {
      const { clientId, clientSecret } = creds();
      const pkce = createPkce();
      const lb = await startLoopback(pkce.state, timeoutMs);
      try {
        await o.openUrl(buildAuthUrl({ authEndpoint: ep.auth, clientId, redirectUri: lb.redirectUri, scope: GCAL_SCOPE, state: pkce.state, challenge: pkce.challenge, extra: { access_type: 'offline', prompt: 'consent' } }));
        const code = await lb.code;
        store(await exchangeCode({ tokenEndpoint: ep.token, clientId, clientSecret, code, verifier: pkce.verifier, redirectUri: lb.redirectUri, fetchImpl: o.fetchImpl, now }));
      } finally { lb.close(); }
    },
    /** Make sure a fresh access token is stored. Throws `not connected` before the first connect. */
    async ensureAccessToken(): Promise<void> {
      const refreshToken = get(GCAL_SECRETS.refresh);
      if (!refreshToken) throw new Error('google-calendar is not connected: use Settings → Secrets → Connect Google Calendar');
      if (get(GCAL_SECRETS.access) && Number(get(EXPIRES)) - SKEW_MS > now()) return;
      const { clientId, clientSecret } = creds();
      store(await refreshAccessToken({ tokenEndpoint: ep.token, clientId, clientSecret, refreshToken, fetchImpl: o.fetchImpl, now }));
    },
    disconnect() { for (const n of [GCAL_SECRETS.access, GCAL_SECRETS.refresh, EXPIRES]) o.secrets.delete(scope, n); },
  };
}
export type GoogleAuth = ReturnType<typeof createGoogleAuth>;
