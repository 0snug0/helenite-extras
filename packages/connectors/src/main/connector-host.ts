// Main-process side of connectors: auth hooks, secret entries for the Settings UI.
import { getConnector } from '../registry';
import type { ConnectorDef } from '../sdk';
import type { GoogleAuth } from './google-auth';
import { appScope, connectorScope, type SecretStore } from './secrets';

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
}

export interface AppSecretDecl { id: string; name: string; secrets: { name: string; label?: string; required?: boolean }[]; connectors?: string[] }

export function createConnectorHost(deps: { secrets: SecretStore; googleAuth?: GoogleAuth }) {
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
