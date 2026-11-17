import fs from 'node:fs';
import path from 'node:path';
import { VAULT_CONNECTORS_DIR, connectorHash, type VaultConnectorFiles } from './vault-connector';

export type ApprovalState = 'new' | 'approved' | 'rejected' | 'changed' | 'host-changed';

export interface ApprovalRecord {
  hash: string;
  decision: 'approved' | 'rejected';
  at: string;
  origins: string[];
}

const SAFE_KEY = /^[A-Za-z0-9_-]+$/;
const PATH_RE = new RegExp(`^${VAULT_CONNECTORS_DIR}/([a-z][a-z0-9-]{1,40})$`);

const validRecord = (v: unknown): v is ApprovalRecord => {
  const r = v as ApprovalRecord;
  return !!r && typeof r === 'object' && typeof r.hash === 'string' && (r.decision === 'approved' || r.decision === 'rejected') && typeof r.at === 'string' && Array.isArray(r.origins) && r.origins.every((o) => typeof o === 'string');
};

/** Approvals live in app user data, never in the vault. */
export function createApprovals(userDataDir: string, vaultKey: string) {
  if (!SAFE_KEY.test(vaultKey)) throw new Error('bad vault key');
  const file = path.join(userDataDir, 'connector-approvals.json');
  const key = (p: string) => `${vaultKey}/${p}`;
  const copyDir = (id: string) => path.join(userDataDir, 'connector-approvals', vaultKey, id);

  const load = (): Record<string, ApprovalRecord> => {
    const out: Record<string, ApprovalRecord> = Object.create(null);
    try {
      const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (raw && typeof raw === 'object') for (const [k, v] of Object.entries(raw)) if (validRecord(v)) out[k] = v;
    } catch {
      // missing or corrupt: nothing approved
    }
    return out;
  };
  const writeAtomic = (target: string, content: string) => {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const tmp = `${target}.tmp`;
    fs.writeFileSync(tmp, content, { mode: 0o600 });
    fs.renameSync(tmp, target);
  };
  const save = (all: Record<string, ApprovalRecord>) => writeAtomic(file, JSON.stringify(all, null, 1));
  const idOf = (p: string): string | null => PATH_RE.exec(p)?.[1] ?? null;
  const record = (p: string): ApprovalRecord | null => {
    const all = load();
    return Object.hasOwn(all, key(p)) ? all[key(p)] : null;
  };

  return {
    state(p: string, hash: string, origins: string[]): ApprovalState {
      const r = record(p);
      if (!r) return 'new';
      if (r.hash !== hash) return 'changed';
      if (r.decision === 'rejected') return 'rejected';
      return origins.every((o) => r.origins.includes(o)) ? 'approved' : 'host-changed';
    },
    decide(f: VaultConnectorFiles, decision: 'approved' | 'rejected', origins: string[]): void {
      const id = idOf(f.path);
      if (!id || id !== f.id) throw new Error(`bad connector path ${f.path}`);
      // Copy first: a record must never claim an approval whose files are not on disk.
      if (decision === 'approved') {
        writeAtomic(path.join(copyDir(id), 'connector.json'), f.manifestText);
        writeAtomic(path.join(copyDir(id), 'connector.js'), f.code);
      }
      const all = load();
      all[key(f.path)] = { hash: connectorHash(f.manifestText, f.code), decision, at: new Date().toISOString(), origins: [...origins] };
      save(all);
    },
    allowOrigin(p: string, origin: string): void {
      const all = load();
      const r = Object.hasOwn(all, key(p)) ? all[key(p)] : null;
      if (!r || r.decision !== 'approved') return;
      if (!r.origins.includes(origin)) all[key(p)] = { ...r, origins: [...r.origins, origin] };
      save(all);
    },
    previous(p: string): { manifestText: string; code: string } | null {
      const id = idOf(p);
      if (!id) return null;
      try {
        return { manifestText: fs.readFileSync(path.join(copyDir(id), 'connector.json'), 'utf8'), code: fs.readFileSync(path.join(copyDir(id), 'connector.js'), 'utf8') };
      } catch {
        return null;
      }
    },
    record,
  };
}
