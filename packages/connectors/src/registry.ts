import { FIRST_PARTY } from './connectors';
import type { ConnectorContext, ConnectorDef, SettingValue } from './sdk';

const defs = new Map<string, ConnectorDef<any>>(FIRST_PARTY.map((d) => [d.id, d]));

export const registerConnector = (def: ConnectorDef<any>) => void defs.set(def.id, def);
export const getConnector = (id: string) => defs.get(id);
export const listConnectors = () => [...defs.values()];

/** Default settings of the named connectors (what `api.settings` falls back to). */
export function connectorSettingDefaults(ids: string[]): Record<string, SettingValue> {
  const out: Record<string, SettingValue> = {};
  for (const id of ids) for (const [k, s] of Object.entries(defs.get(id)?.settings ?? {})) out[k] = s.default;
  return out;
}

/** Build `api.connectors` for the connector ids a manifest declares. Unknown ids throw. */
export function createConnectors(ids: string[], ctx: ConnectorContext): Record<string, any> {
  const out: Record<string, any> = {};
  for (const id of ids) {
    const d = defs.get(id);
    if (!d) throw new Error(`unknown connector "${id}"`);
    out[id] = d.client(ctx);
  }
  return out;
}
