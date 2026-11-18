// Main-process side of connectors: auth hooks, secret entries for the Settings UI.
import { getConnector } from '../registry';
import type { ConnectorContext, ConnectorDef } from '../sdk';
import type { GoogleAuth } from './google-auth';
import { appScope, connectorScope, type SecretAccess } from './secrets';

export interface SecretEntry {
  scope: string;
  /** Human heading: the app or connector the secret belongs to. */
  owner: string;
  name: string;
  label: string;
  required: boolean;
  isSet: boolean;
  /** Managed secrets (OAuth tokens) are written by a connect flow, not typed in. */
  managed: boolean;
  /** Who owns it: Home only, shared from Home (policy-gated in vaults), or one vault's own. Absent means the vault's own. */
  class?: 'home' | 'shared' | 'vault';
  /** Home's Vaults policy for a shared secret; sent to Home only. */
  policy?: SecretVaultsPolicy;
}

/** Which vaults may use a shared secret, keyed by vault uuid. There is no on/off default for a secret. */
export type SecretVaultsPolicy = 'all' | 'none' | { only: string[] } | { except: string[] };

export interface AppSecretDecl { id: string; name: string; secrets: { name: string; label?: string; required?: boolean }[]; connectors?: string[] }

export function createConnectorHost(deps: { secrets: SecretAccess; googleAuth?: GoogleAuth }) {
  return {
    /** The `ensureAuth` hook for a connector's context: refresh tokens right before use. */
    async ensureAuth(connectorId: string): Promise<void> {
      if (connectorId === 'google-calendar') {
        if (!deps.googleAuth) throw new Error('google-calendar auth is not configured');
        await deps.googleAuth.ensureAccessToken();
      }
    },
    /** Everything Settings → Secrets lists: each app's declared secrets, then each connector's. Names only, never values. */
    entries(apps: AppSecretDecl[], connectorIds?: string[]): SecretEntry[] {
      const out: SecretEntry[] = [];
      const managed = new Set(['GCAL_ACCESS_TOKEN', 'GCAL_REFRESH_TOKEN']);
      for (const a of apps) for (const s of a.secrets) out.push({ scope: appScope(a.id), owner: a.name, name: s.name, label: s.label ?? s.name, required: !!s.required, isSet: deps.secrets.has(appScope(a.id), s.name), managed: false });
      const ids = connectorIds ?? [...new Set(apps.flatMap((a) => a.connectors ?? []))];
      for (const id of ids) {
        const d: ConnectorDef | undefined = getConnector(id);
        for (const s of d?.secrets ?? []) out.push({ scope: connectorScope(id), owner: d!.name, name: s.name, label: s.label, required: s.required, isSet: deps.secrets.has(connectorScope(id), s.name), managed: managed.has(s.name) });
      }
      return out;
    },
  };
}
export type ConnectorHost = ReturnType<typeof createConnectorHost>;

// ---- Session R's ConnectorHost contract (`@helenite/apps-runtime` main/connectors.ts), implemented structurally. ----
export interface ConnectorCall { appId: string; connectorId: string; method: string; args: unknown[]; vaultRoot: string }

export interface RegistryHostOptions {
  /** Build the context for one call: `fetch` must be the app's brokered net.fetch (grants, host-bound secrets, redaction). */
  ctxFor(call: Pick<ConnectorCall, 'appId' | 'connectorId' | 'vaultRoot'>): ConnectorContext;
  /** Token refresh hook (`createConnectorHost(...).ensureAuth`). */
  ensureAuth?(connectorId: string): Promise<void>;
}

/** Runs `connector.client(ctx)[method](...args)` in main. Plug into `createAppRuntime({ connectors })`. */
export function createConnectorRegistryHost(o: RegistryHostOptions) {
  const clients = new Map<string, Record<string, unknown>>();
  const probe = (id: string) => {
    let c = clients.get(id);
    if (!c) { c = getConnector(id)!.client({ fetch: async () => { throw new Error('probe'); }, settings: {} }) as Record<string, unknown>; clients.set(id, c); }
    return c;
  };
  return {
    has: (id: string) => !!getConnector(id),
    describe: (id: string) => (getConnector(id) ? { methods: Object.keys(probe(id)).filter((k) => typeof probe(id)[k] === 'function') } : null),
    async invoke(call: ConnectorCall): Promise<unknown> {
      const def = getConnector(call.connectorId);
      if (!def) throw Object.assign(new Error(`connector ${call.connectorId} is not installed`), { code: 'unavailable' });
      if (!Object.keys(probe(call.connectorId)).includes(call.method) || call.method === 'constructor') throw Object.assign(new Error(`connector ${call.connectorId} has no method ${call.method}`), { code: 'unknown-method' });
      const ctx = o.ctxFor(call);
      const client = def.client({ ...ctx, ensureAuth: ctx.ensureAuth ?? o.ensureAuth }) as Record<string, (...a: unknown[]) => unknown>;
      return await client[call.method](...call.args);
    },
  };
}
