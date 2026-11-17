// Secrets: values encrypted with Electron safeStorage (its key lives in the macOS keychain as "<app name> Safe Storage"),
// ciphertext kept in <userData>/secrets.json (mode 0600). Never inside the vault, never in a manifest or an app's reach.
// Scopes: `app:<appId>` for an app's own secrets, `connector:<id>` for secrets a connector manages for every app.
import fs from 'node:fs';
import path from 'node:path';
import { getConnector } from '../registry';

export interface SafeStorageLike {
  isAsyncEncryptionAvailable(): Promise<boolean>;
  encryptStringAsync(plain: string): Promise<Buffer>;
  decryptStringAsync(cipher: Buffer): Promise<{ result: string; shouldReEncrypt?: boolean }>;
}

export const appScope = (appId: string) => `app:${appId}`;
export const connectorScope = (id: string) => `connector:${id}`;

export interface SecretStore {
  readonly backend: string;
  /** Resolves once availability is known and stored values are decrypted. Use the store only after it. */
  readonly ready: Promise<void>;
  /** Resolves once every earlier set/delete has reached the file. */
  flush(): Promise<void>;
  has(scope: string, name: string): boolean;
  get(scope: string, name: string): string | null;
  set(scope: string, name: string, value: string): void;
  delete(scope: string, name: string): void;
  /** Names stored under a scope (never values). */
  names(scope: string): string[];
}

/** What auth and the UI need. Session R's `SecretStore` (keyed by an id string) satisfies this when given our scope strings. */
export type SecretAccess = Pick<SecretStore, 'has' | 'get' | 'set' | 'delete'>;

const UNAVAILABLE = 'keychain encryption is not available in this process';

/**
 * Electron deprecated safeStorage's sync calls, so the store decrypts every value once (`ready`) and serves reads
 * from memory. Writes update memory at once and reach the file in the background, in call order (`flush()` waits).
 * This process owns the file: a value another process writes appears after a restart.
 */
export function createSecretStore(opts: { userDataDir: string; safeStorage: SafeStorageLike }): SecretStore {
  const file = path.join(opts.userDataDir, 'secrets.json');
  const load = (): Record<string, string> => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return {}; } };
  const save = (all: Record<string, string>) => {
    fs.mkdirSync(opts.userDataDir, { recursive: true });
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(all, null, 1), { mode: 0o600 });
    fs.renameSync(tmp, file);
  };
  const key = (scope: string, name: string) => `${scope}/${name}`;

  const stored = new Set(Object.keys(load())); // keys present, known without decrypting
  const plain = new Map<string, string>();
  const failed = new Map<string, unknown>(); // keys whose ciphertext would not decrypt
  let available = false;
  let loaded = false;
  let writes: Promise<void> = Promise.resolve();
  const enqueue = (op: () => Promise<void>) => {
    writes = writes.then(op).catch((err) => console.error('[secrets] write failed', err));
  };
  const persist = (k: string, value: string) =>
    enqueue(async () => {
      const enc = (await opts.safeStorage.encryptStringAsync(value)).toString('base64');
      if (plain.get(k) !== value) return; // superseded by a later set or delete
      const all = load();
      all[k] = enc;
      save(all);
    });

  const ready = (async () => {
    available = await opts.safeStorage.isAsyncEncryptionAvailable().catch(() => false);
    if (!available) return;
    for (const [k, enc] of Object.entries(load())) {
      try {
        const { result, shouldReEncrypt } = await opts.safeStorage.decryptStringAsync(Buffer.from(enc, 'base64'));
        plain.set(k, result);
        if (shouldReEncrypt) persist(k, result);
      } catch (err) {
        failed.set(k, err);
      }
    }
    loaded = true;
  })();
  const usable = () => {
    if (!available) throw new Error(UNAVAILABLE);
    if (!loaded) throw new Error('secret store is not ready yet');
  };

  return {
    get backend() { return available ? 'safeStorage (keychain)' : 'unavailable'; },
    ready,
    flush: () => writes,
    has: (scope, name) => stored.has(key(scope, name)),
    get(scope, name) {
      const k = key(scope, name);
      if (!stored.has(k)) return null;
      usable();
      if (failed.has(k)) throw failed.get(k);
      return plain.get(k)!;
    },
    set(scope, name, value) {
      usable();
      const k = key(scope, name);
      const v = String(value);
      stored.add(k);
      plain.set(k, v);
      failed.delete(k);
      persist(k, v);
    },
    delete(scope, name) {
      const k = key(scope, name);
      if (!stored.delete(k)) return;
      plain.delete(k);
      failed.delete(k);
      enqueue(async () => {
        const all = load();
        if (delete all[k]) save(all);
      });
    },
    names: (scope) => [...stored].filter((k) => k.startsWith(`${scope}/`)).map((k) => k.slice(scope.length + 1)),
  };
}

/** Reversible stand-in for safeStorage, for tests and CI where no keychain exists. NOT encryption. */
export function createFakeSafeStorage(): SafeStorageLike {
  return {
    isAsyncEncryptionAvailable: async () => true,
    encryptStringAsync: async (s) => Buffer.from(`fake:${s}`, 'utf8'),
    decryptStringAsync: async (b) => ({ result: b.toString('utf8').replace(/^fake:/, '') }),
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
