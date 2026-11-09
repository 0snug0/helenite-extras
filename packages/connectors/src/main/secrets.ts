// Secrets: values encrypted with Electron safeStorage (its key lives in the macOS keychain as "<app name> Safe Storage"),
// ciphertext kept in <userData>/secrets.json (mode 0600). Never inside the vault, never in a manifest or an app's reach.
// Scopes: `app:<appId>` for an app's own secrets, `connector:<id>` for secrets a connector manages for every app.
import fs from 'node:fs';
import path from 'node:path';
import { getConnector } from '../registry';

export interface SafeStorageLike {
  isEncryptionAvailable(): boolean;
  encryptString(plain: string): Buffer;
  decryptString(cipher: Buffer): string;
}

export const appScope = (appId: string) => `app:${appId}`;
export const connectorScope = (id: string) => `connector:${id}`;

export interface SecretStore {
  readonly backend: string;
  has(scope: string, name: string): boolean;
  get(scope: string, name: string): string | null;
  set(scope: string, name: string, value: string): void;
  delete(scope: string, name: string): void;
  /** Names stored under a scope (never values). */
  names(scope: string): string[];
}

export function createSecretStore(opts: { userDataDir: string; safeStorage: SafeStorageLike }): SecretStore {
  const file = path.join(opts.userDataDir, 'secrets.json');
  const load = (): Record<string, string> => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return {}; } };
  const save = (all: Record<string, string>) => {
    fs.mkdirSync(opts.userDataDir, { recursive: true });
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(all, null, 1), { mode: 0o600 });
    fs.renameSync(tmp, file);
  };
  const usable = () => !!opts.safeStorage.isEncryptionAvailable();
  const key = (scope: string, name: string) => `${scope}/${name}`;
  return {
    backend: usable() ? 'safeStorage (keychain)' : 'unavailable',
    has: (scope, name) => key(scope, name) in load(),
    get(scope, name) {
      const enc = load()[key(scope, name)];
      if (enc == null) return null;
      if (!usable()) throw new Error('keychain encryption is not available in this process');
      return opts.safeStorage.decryptString(Buffer.from(enc, 'base64'));
    },
    set(scope, name, value) {
      if (!usable()) throw new Error('keychain encryption is not available in this process');
      const all = load();
      all[key(scope, name)] = opts.safeStorage.encryptString(String(value)).toString('base64');
      save(all);
    },
    delete(scope, name) {
      const all = load();
      if (delete all[key(scope, name)]) save(all);
    },
    names: (scope) => Object.keys(load()).filter((k) => k.startsWith(`${scope}/`)).map((k) => k.slice(scope.length + 1)),
  };
}

/** Reversible stand-in for safeStorage, for tests and CI where no keychain exists. NOT encryption. */
export function createFakeSafeStorage(): SafeStorageLike {
  return {
    isEncryptionAvailable: () => true,
    encryptString: (s) => Buffer.from(`fake:${s}`, 'utf8'),
    decryptString: (b) => b.toString('utf8').replace(/^fake:/, ''),
  };
}

/**
 * Resolve a `{{secret:NAME}}` for an app: the app's own secret first, then the secret of a connector the app declared
 * (so google-calendar's token is shared by every app that lists the connector). Returns null when unset.
 */
export function resolveSecret(store: SecretStore, appId: string, name: string, connectorIds: string[] = []): string | null {
  const own = store.get(appScope(appId), name);
  if (own != null) return own;
  for (const id of connectorIds) {
    if (!getConnector(id)?.secrets.some((s) => s.name === name)) continue;
    const v = store.get(connectorScope(id), name);
    if (v != null) return v;
  }
  return null;
}
