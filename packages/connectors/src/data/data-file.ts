import fs from 'node:fs';
import path from 'node:path';
import type { SettingValue } from '../sdk';
import { parseContract, type Contract } from './contract';

/** `<vault>/.helenite/data.json`: which connectors serve each contract, plus per-connector setting overrides. */
export interface DataFile {
  bindings: Record<string, string[]>;
  settings: Record<string, Record<string, SettingValue>>;
}

const DATA_FILE = path.join('.helenite', 'data.json');
const TEMPLATE_FILE = 'helenite-template.json';

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const isSetting = (v: unknown): v is SettingValue => typeof v === 'string' || typeof v === 'boolean' || (typeof v === 'number' && Number.isFinite(v));
const nullMap = <T>(): Record<string, T> => Object.create(null);

export function readDataFile(vaultRoot: string): DataFile {
  const out: DataFile = { bindings: nullMap(), settings: nullMap() };
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(path.join(vaultRoot, DATA_FILE), 'utf8'));
  } catch {
    return out;
  }
  if (!isObject(raw)) return out;
  if (isObject(raw.bindings)) {
    for (const [contract, ids] of Object.entries(raw.bindings)) {
      if (Array.isArray(ids)) out.bindings[contract] = ids.filter((id): id is string => typeof id === 'string');
    }
  }
  if (isObject(raw.settings)) {
    for (const [connector, values] of Object.entries(raw.settings)) {
      if (!isObject(values)) continue;
      const kept = nullMap<SettingValue>();
      for (const [k, v] of Object.entries(values)) if (isSetting(v)) kept[k] = v;
      out.settings[connector] = kept;
    }
  }
  return out;
}

export function writeDataFile(vaultRoot: string, f: DataFile): void {
  const file = path.join(vaultRoot, DATA_FILE);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify({ bindings: f.bindings, settings: f.settings }, null, 2)}\n`);
  fs.renameSync(tmp, file);
}

// A contract path must be a relative path that stays inside the vault and crosses no symlink.
function readContractFile(vaultRoot: string, rel: string): string {
  if (!rel || path.isAbsolute(rel) || rel.includes('\0')) throw new Error('path must be inside the vault');
  const parts = rel.split(/[\\/]+/);
  if (parts.some((p) => p === '..')) throw new Error('path must be inside the vault');
  let cur = vaultRoot;
  for (const part of parts) {
    if (!part || part === '.') continue;
    cur = path.join(cur, part);
    if (fs.lstatSync(cur).isSymbolicLink()) throw new Error('path must not be a symlink');
  }
  if (!fs.lstatSync(cur).isFile()) throw new Error('not a file');
  return fs.readFileSync(cur, 'utf8');
}

/** Contracts a vault template ships, keyed by name. No manifest → empty map. */
export function loadTemplateContracts(vaultRoot: string): Map<string, Contract | { error: string }> {
  const out = new Map<string, Contract | { error: string }>();
  let manifest: unknown;
  try {
    manifest = JSON.parse(fs.readFileSync(path.join(vaultRoot, TEMPLATE_FILE), 'utf8'));
  } catch {
    return out;
  }
  if (!isObject(manifest) || !isObject(manifest.data)) return out;
  for (const [name, rel] of Object.entries(manifest.data)) {
    if (typeof rel !== 'string') {
      out.set(name, { error: `${name}: contract path must be a string` });
      continue;
    }
    let text: string;
    try {
      text = readContractFile(vaultRoot, rel);
    } catch (e) {
      out.set(name, { error: `${name}: can't read ${rel}: ${e instanceof Error ? e.message : String(e)}` });
      continue;
    }
    const parsed = parseContract(name, text);
    out.set(name, 'error' in parsed ? { error: parsed.error } : parsed.contract);
  }
  return out;
}
