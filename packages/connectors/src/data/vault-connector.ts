import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { originOf, type ProvidesSpec, type SecretSpec, type SettingSpec, type SettingValue } from '../sdk';

export const VAULT_CONNECTORS_DIR = 'Connectors';

export interface VaultConnectorManifest {
  id: string;
  name: string;
  description: string;
  hosts: string[];
  hostSettings: string[];
  settings: Record<string, SettingSpec>;
  secrets: SecretSpec[];
  provides: Record<string, ProvidesSpec>;
}

export interface VaultConnectorFiles {
  id: string;
  /** `Connectors/<id>` */
  path: string;
  manifestText: string;
  code: string;
}

const MANIFEST_FILE = 'connector.json';
const CODE_FILE = 'connector.js';
const ID_RE = /^[a-z][a-z0-9-]{1,40}$/;
const NAME_RE = /^[A-Za-z_]\w*$/;
const SECRET_RE = /^[A-Z][A-Z0-9_]*$/;
const HOSTILE = new Set(['constructor', '__proto__', 'prototype', 'toString', 'valueOf']);

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const isStringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string');
const safeName = (s: unknown): s is string => typeof s === 'string' && NAME_RE.test(s) && !HOSTILE.has(s);
const has = (o: object, k: string) => Object.hasOwn(o, k);

const bareOrigin = (s: string): boolean => {
  try {
    const u = new URL(s);
    return (u.protocol === 'http:' || u.protocol === 'https:') && originOf(s) === s;
  } catch {
    return false;
  }
};

/** Origin of an http(s) URL, else null (file:, data: and friends have the opaque origin "null"). */
const httpOrigin = (v: unknown): string | null => {
  try {
    const u = new URL(String(v));
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.origin : null;
  } catch {
    return null;
  }
};

export function parseVaultConnectorManifest(
  text: string,
  folderId: string,
  builtinIds: ReadonlySet<string>,
): { manifest: VaultConnectorManifest } | { error: string } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { error: 'connector.json is not valid JSON' };
  }
  if (!isObject(raw)) return { error: 'connector.json must be a JSON object' };
  const { id, name, description } = raw;
  if (typeof id !== 'string' || !ID_RE.test(id)) return { error: 'id must be lowercase letters, digits and hyphens' };
  if (id !== folderId) return { error: `id "${id}" must match its folder name "${folderId}"` };
  if (builtinIds.has(id)) return { error: `${id} is a built-in connector; rename this one.` };
  if (typeof name !== 'string' || !name) return { error: 'name must be a non-empty string' };
  if (description !== undefined && typeof description !== 'string') return { error: 'description must be a string' };

  const hosts = raw.hosts ?? [];
  if (!isStringArray(hosts)) return { error: 'hosts must be an array of origins' };
  for (const h of hosts) if (!bareOrigin(h)) return { error: `hosts entry "${h}" must be a bare origin like https://api.example.com` };

  const settings: Record<string, SettingSpec> = Object.create(null);
  const rawSettings = raw.settings ?? {};
  if (!isObject(rawSettings)) return { error: 'settings must be an object' };
  for (const [key, spec] of Object.entries(rawSettings)) {
    if (!safeName(key)) return { error: `setting name "${key}" is not allowed` };
    if (!isObject(spec)) return { error: `setting ${key} must be an object` };
    const d = spec.default;
    if (typeof d !== 'string' && typeof d !== 'number' && typeof d !== 'boolean') return { error: `setting ${key} default must be a string, number or boolean` };
    if (typeof spec.label !== 'string') return { error: `setting ${key} label must be a string` };
    settings[key] = { default: d, label: spec.label };
  }

  const hostSettings = raw.hostSettings ?? [];
  if (!isStringArray(hostSettings)) return { error: 'hostSettings must be an array of setting names' };
  for (const h of hostSettings) {
    if (!has(settings, h)) return { error: `hostSettings "${h}" is not a declared setting` };
    if (!httpOrigin(settings[h].default)) return { error: `hostSettings "${h}" default must be an http(s) URL` };
  }

  const secrets: SecretSpec[] = [];
  const rawSecrets = raw.secrets ?? [];
  if (!Array.isArray(rawSecrets)) return { error: 'secrets must be an array' };
  for (const s of rawSecrets) {
    if (!isObject(s) || typeof s.name !== 'string' || !SECRET_RE.test(s.name)) return { error: 'secret name must be UPPER_SNAKE_CASE' };
    if (typeof s.label !== 'string' || typeof s.required !== 'boolean') return { error: `secret ${s.name} needs a label and required flag` };
    const spec: SecretSpec = { name: s.name, label: s.label, required: s.required };
    if (s.hostSetting !== undefined) {
      if (typeof s.hostSetting !== 'string' || !hostSettings.includes(s.hostSetting)) return { error: `secret ${s.name} hostSetting must be listed in hostSettings` };
      spec.hostSetting = s.hostSetting;
    }
    if (s.host !== undefined) {
      if (typeof s.host !== 'string' || !hosts.includes(s.host)) return { error: `secret ${s.name} host must be listed in hosts` };
      spec.host = s.host;
    }
    secrets.push(spec);
  }

  const provides: Record<string, ProvidesSpec> = Object.create(null);
  const rawProvides = raw.provides ?? {};
  if (!isObject(rawProvides)) return { error: 'provides must be an object' };
  for (const [contract, p] of Object.entries(rawProvides)) {
    if (!ID_RE.test(contract)) return { error: `provides contract name "${contract}" is not allowed` };
    if (!isObject(p)) return { error: `provides ${contract} must be an object` };
    const spec: ProvidesSpec = {};
    if (p.list !== undefined) {
      if (!safeName(p.list)) return { error: `provides ${contract} list method "${String(p.list)}" is not allowed` };
      spec.list = p.list;
    }
    if (p.actions !== undefined) {
      if (!isObject(p.actions)) return { error: `provides ${contract} actions must be an object` };
      const actions: Record<string, string> = Object.create(null);
      for (const [action, method] of Object.entries(p.actions)) {
        if (!safeName(action) || !safeName(method)) return { error: `provides ${contract} action "${action}" is not allowed` };
        actions[action] = method;
      }
      spec.actions = actions;
    }
    provides[contract] = spec;
  }

  return { manifest: { id, name, description: description ?? '', hosts, hostSettings, settings, secrets, provides } };
}

/** SHA-256 hex of `connector.json` + NUL + `connector.js`. */
export const connectorHash = (manifestText: string, code: string): string =>
  crypto.createHash('sha256').update(manifestText).update('\0').update(code).digest('hex');

export function resolvedOrigins(m: VaultConnectorManifest, settings: Record<string, SettingValue>): string[] {
  const out = new Set(m.hosts);
  for (const key of m.hostSettings) {
    const v = Object.hasOwn(settings, key) ? settings[key] : m.settings[key]?.default;
    const origin = httpOrigin(v);
    if (origin) out.add(origin);
  }
  return [...out];
}

// Fatal decoding keeps string<->bytes exact, so hashing the string equals hashing the file bytes.
const STRICT_UTF8 = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });

/** Reads a regular file without following a symlink at the leaf. */
function readRegularFile(file: string): string {
  const st = fs.lstatSync(file);
  if (st.isSymbolicLink()) throw new Error('is a symlink');
  if (!st.isFile()) throw new Error('is not a regular file');
  const fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  try {
    if (!fs.fstatSync(fd).isFile()) throw new Error('is not a regular file');
    return STRICT_UTF8.decode(fs.readFileSync(fd));
  } finally {
    fs.closeSync(fd);
  }
}

export function readVaultConnectors(vaultRoot: string): { found: VaultConnectorFiles[]; errors: { path: string; error: string }[] } {
  const found: VaultConnectorFiles[] = [];
  const errors: { path: string; error: string }[] = [];
  const dir = path.join(vaultRoot, VAULT_CONNECTORS_DIR);
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return { found, errors };
  }
  for (const e of entries.sort((a, b) => (a.name < b.name ? -1 : 1))) {
    if (e.name.startsWith('.')) continue;
    const rel = `${VAULT_CONNECTORS_DIR}/${e.name}`;
    if (e.isSymbolicLink()) {
      errors.push({ path: rel, error: 'connector folder is a symlink' });
      continue;
    }
    if (!e.isDirectory()) continue;
    const texts: string[] = [];
    let failure: string | null = null;
    for (const file of [MANIFEST_FILE, CODE_FILE]) {
      try {
        texts.push(readRegularFile(path.join(dir, e.name, file)));
      } catch (err) {
        const code = (err as NodeJS.ErrnoException).code;
        failure = err instanceof TypeError ? `${file} is not valid UTF-8` : code === 'ENOENT' ? `missing ${file}` : code === 'ELOOP' ? `${file} is a symlink` : `${file} ${(err as Error).message}`;
        break;
      }
    }
    if (failure) errors.push({ path: rel, error: failure });
    else found.push({ id: e.name, path: rel, manifestText: texts[0], code: texts[1] });
  }
  return { found, errors };
}
