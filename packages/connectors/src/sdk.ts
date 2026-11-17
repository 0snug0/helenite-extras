// Connector SDK. A connector owns a service's URLs, auth placement and retries; apps call
// `api.connectors.radarr.getQueue()` and never build secret-placeholder strings themselves.
// Client code runs inside the sandboxed frame (or a hidden job renderer): it only talks through `ctx.fetch`
// (the host's net.fetch) and refers to secrets by `{{secret:NAME}}` placeholders the host fills in per bound host.

export interface NetRequest {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string | object;
  timeout?: number;
}
export interface NetResponse {
  status: number;
  headers: Record<string, string>;
  text: string;
}
export type SettingValue = string | number | boolean;

/**
 * Account-backed data for connectors. Structural on purpose: connectors must not import @helenite/accounts
 * (which depends on connectors). The host passes a vault-scoped VaultAccounts; only granted accounts appear.
 */
export interface ConnectorCalendarEvent {
  id: string; calendarId: string; summary: string; start: string; end: string; allDay: boolean; location?: string; htmlLink?: string; account: string;
}
export interface ConnectorAccounts {
  calendarEvents(o: { from: string; to: string; accounts?: string[] }): Promise<{ events: ConnectorCalendarEvent[]; errors: { account: string; message: string }[] }>;
  list(): { id: string; label: string; provider: string; services: string[] }[];
}

export interface ConnectorContext {
  /** The host's `api.net.fetch`: origin-scoped, CORS-free, fills `{{secret:NAME}}` placeholders. Never throws on HTTP status. */
  fetch(req: NetRequest): Promise<NetResponse>;
  /** Resolved app settings (vault overrides over manifest defaults). */
  settings: Record<string, SettingValue>;
  /** Host-side hook for connectors that refresh tokens (google-calendar). Defaults to a no-op. */
  ensureAuth?(connectorId: string): Promise<void>;
  /** Vault-scoped accounts, when the host has them. Unset in builds or vaults without accounts. */
  accounts?: ConnectorAccounts;
  /** Injectable for tests. */
  sleep?(ms: number): Promise<void>;
}

export interface SecretSpec {
  name: string;
  label: string;
  required: boolean;
  /** Which setting holds the origin this secret may be sent to (or a fixed origin). */
  hostSetting?: string;
  host?: string;
}
export interface SettingSpec {
  default: SettingValue;
  label: string;
}

export interface ConnectorDef<C = unknown> {
  id: string;
  name: string;
  description: string;
  secrets: SecretSpec[];
  settings: Record<string, SettingSpec>;
  /** Origins (`scheme://host:port`) this connector talks to, given resolved settings. Must be a subset of the manifest's `net`. */
  hosts(settings: Record<string, SettingValue>): string[];
  client(ctx: ConnectorContext): C;
}

export function defineConnector<C>(def: ConnectorDef<C>): ConnectorDef<C> {
  if (!/^[a-z][a-z0-9-]{1,40}$/.test(def.id)) throw new Error(`bad connector id ${def.id}`);
  for (const s of def.secrets) if (!/^[A-Z][A-Z0-9_]*$/.test(s.name)) throw new Error(`bad secret name ${s.name}`);
  return def;
}

export class ConnectorError extends Error {
  constructor(public connector: string, public status: number, message: string) {
    super(message);
    this.name = 'ConnectorError';
  }
}

export const secretRef = (name: string): string => `{{secret:${name}}}`;
export const originOf = (url: unknown): string => new URL(String(url)).origin;

export const query = (params: Record<string, string | number | boolean | undefined | null>): string => {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(params)) if (v != null) parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  return parts.length ? `?${parts.join('&')}` : '';
};

export interface RequestOpts extends NetRequest {
  /** Extra attempts after the first for network errors, 429 and 5xx. Default 2 (GETs only; writes default 0). */
  retries?: number;
  /** HTTP statuses that are not errors (returned as-is). */
  okStatus?: number[];
}

const sleepDefault = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Perform a request with retry/backoff; non-2xx throws ConnectorError. Returns the response. */
export async function request(connector: string, ctx: ConnectorContext, opts: RequestOpts): Promise<NetResponse> {
  const method = (opts.method ?? 'GET').toUpperCase();
  const retries = opts.retries ?? (method === 'GET' ? 2 : 0);
  const sleep = ctx.sleep ?? sleepDefault;
  const { retries: _r, okStatus, ...req } = opts;
  let last: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt) await sleep(Math.min(2000, 200 * 2 ** (attempt - 1)));
    try {
      const res = await ctx.fetch(req);
      if (res.status >= 200 && res.status < 300) return res;
      if (okStatus?.includes(res.status)) return res;
      const err = new ConnectorError(connector, res.status, `${connector}: ${method} ${safeOrigin(req.url)} → HTTP ${res.status}`);
      if (res.status === 429 || res.status >= 500) { last = err; continue; }
      throw err;
    } catch (e) {
      if (e instanceof ConnectorError) { if (e.status === 429 || e.status >= 500) { last = e; continue; } throw e; }
      last = e; // network error from the host: retry
    }
  }
  throw last instanceof Error ? last : new ConnectorError(connector, 0, `${connector}: request failed`);
}

function safeOrigin(url: string): string {
  try { return new URL(url.replace(/\{\{secret:[A-Z0-9_]+\}\}/g, 'x')).origin; } catch { return 'invalid-url'; }
}

export async function requestJson<T = any>(connector: string, ctx: ConnectorContext, opts: RequestOpts): Promise<T> {
  const res = await request(connector, ctx, opts);
  if (!res.text) return undefined as T;
  try { return JSON.parse(res.text) as T; } catch { throw new ConnectorError(connector, res.status, `${connector}: response was not JSON`); }
}

export const settingString = (ctx: ConnectorContext, name: string): string => String(ctx.settings[name] ?? '').replace(/\/+$/, '');

/** What the manifest must allow for a set of connectors: net origins and secret → host bindings. */
export function connectorPermissions(defs: ConnectorDef[], settings: Record<string, SettingValue>) {
  const net = new Set<string>();
  const secrets: { name: string; hosts: string[] }[] = [];
  for (const d of defs) {
    const hosts = d.hosts(settings);
    hosts.forEach((h) => net.add(h));
    for (const s of d.secrets) {
      const host = s.host ?? (s.hostSetting ? originOf(settings[s.hostSetting] ?? d.settings[s.hostSetting]?.default) : undefined);
      secrets.push({ name: s.name, hosts: host ? [host] : hosts });
    }
  }
  return { net: [...net], secrets };
}
