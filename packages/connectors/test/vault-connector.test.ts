import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { connectorHash, parseVaultConnectorManifest, readVaultConnectors, resolvedOrigins } from '../src/data';

const base = {
  id: 'my-conn',
  name: 'My',
  description: 'd',
  hosts: ['https://api.example.com'],
  hostSettings: ['baseUrl'],
  settings: { baseUrl: { default: 'http://localhost:7878', label: 'URL' } },
  secrets: [{ name: 'KEY', label: 'Key', required: true, hostSetting: 'baseUrl' }],
  provides: { 'download-queue': { list: 'queue', actions: { remove: 'removeItem' } } },
};
const parse = (o: unknown, id = 'my-conn', builtin: string[] = ['radarr']) => parseVaultConnectorManifest(JSON.stringify(o), id, new Set(builtin));
const err = (r: ReturnType<typeof parse>) => ('error' in r ? r.error : '');

describe('parseVaultConnectorManifest', () => {
  it('accepts a valid manifest', () => {
    const r = parse(base);
    expect('manifest' in r && r.manifest.provides['download-queue'].list).toBe('queue');
  });
  it('requires id to equal the folder name', () => expect(err(parse(base, 'other'))).toMatch(/folder/));
  it('uses the collision copy for built-in ids', () => expect(err(parse({ ...base, id: 'radarr' }, 'radarr'))).toBe('radarr is a built-in connector; rename this one.'));
  it.each(['https://a.com/path', 'a.com', 'https://a.com/', 'ftp://a.com', 'https://user@a.com'])('rejects non-origin host %s', (h) => {
    expect(err(parse({ ...base, hosts: [h] }))).toMatch(/hosts/);
  });
  it('requires hostSettings to be declared settings, even prototype names', () => {
    expect(err(parse({ ...base, hostSettings: ['nope'] }))).toMatch(/hostSettings/);
    expect(err(parse({ ...base, hostSettings: ['constructor'] }))).toMatch(/hostSettings/);
  });
  it('requires a secret hostSetting to be in hostSettings and host to be in hosts', () => {
    const bad = { ...base, hostSettings: [], secrets: [{ name: 'K', label: 'k', required: true, hostSetting: 'baseUrl' }] };
    expect(err(parse(bad))).toMatch(/hostSetting/);
    expect(err(parse({ ...base, secrets: [{ name: 'K', label: 'k', required: true, host: 'https://evil.com' }] }))).toMatch(/host/);
    expect('manifest' in parse({ ...base, secrets: [{ name: 'K', label: 'k', required: false, host: 'https://api.example.com' }] })).toBe(true);
  });
  it.each(['constructor', '__proto__', 'prototype', 'toString', 'valueOf', '1bad', 'a-b', ''])('rejects method name %j', (m) => {
    expect(err(parse({ ...base, provides: { x: { list: m } } }))).toMatch(/not allowed/);
    expect(err(parse({ ...base, provides: { 'x-y': { actions: { remove: m } } } }))).toMatch(/not allowed/);
  });
  it('rejects hostile action and setting names written as JSON own keys', () => {
    expect(err(parseVaultConnectorManifest('{"id":"a-b","name":"n","provides":{"x-y":{"actions":{"__proto__":"m"}}}}', 'a-b', new Set()))).toMatch(/not allowed/);
    expect(err(parseVaultConnectorManifest('{"id":"a-b","name":"n","settings":{"__proto__":{"default":1,"label":"l"}}}', 'a-b', new Set()))).toMatch(/not allowed/);
  });
  it('rejects bad JSON and bad shapes', () => {
    expect(err(parseVaultConnectorManifest('{', 'a-b', new Set()))).toMatch(/JSON/);
    expect(err(parse({ ...base, settings: { s: { default: {}, label: 'l' } } }))).toMatch(/default/);
    expect(err(parse({ ...base, secrets: [{ name: 'lower', label: 'k', required: true }] }))).toMatch(/UPPER/);
  });
  it('returns null-prototype maps', () => {
    const r = parse(base);
    if (!('manifest' in r)) throw new Error('x');
    expect(Object.getPrototypeOf(r.manifest.provides)).toBeNull();
    expect(Object.getPrototypeOf(r.manifest.settings)).toBeNull();
  });
});

describe('connectorHash', () => {
  it('changes when either file changes and separates them', () => {
    const h = connectorHash('a', 'b');
    expect(connectorHash('a2', 'b')).not.toBe(h);
    expect(connectorHash('a', 'b2')).not.toBe(h);
    expect(connectorHash('ab', '')).not.toBe(connectorHash('a', 'b'));
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('resolvedOrigins', () => {
  const m = (() => {
    const r = parse(base);
    if (!('manifest' in r)) throw new Error('x');
    return r.manifest;
  })();
  it('unions hosts with the origin of each hostSetting value, falling back to the default', () => {
    expect(resolvedOrigins(m, {}).sort()).toEqual(['http://localhost:7878', 'https://api.example.com']);
    expect(resolvedOrigins(m, { baseUrl: 'https://box.lan:9000/x' }).sort()).toEqual(['https://api.example.com', 'https://box.lan:9000']);
  });
  it('ignores an unparseable value', () => {
    expect(resolvedOrigins(m, { baseUrl: 'not a url' })).toEqual(['https://api.example.com']);
  });
});

describe('readVaultConnectors', () => {
  const dirs: string[] = [];
  const vault = () => {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'vc-'));
    dirs.push(d);
    return d;
  };
  afterEach(() => dirs.splice(0).forEach((d) => fs.rmSync(d, { recursive: true, force: true })));
  const put = (root: string, rel: string, text: string) => {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), text);
  };

  it('reads a complete folder', () => {
    const v = vault();
    put(v, 'Connectors/a-b/connector.json', '{}');
    put(v, 'Connectors/a-b/connector.js', 'code');
    expect(readVaultConnectors(v)).toEqual({ found: [{ id: 'a-b', path: 'Connectors/a-b', manifestText: '{}', code: 'code' }], errors: [] });
  });
  it('returns nothing when there is no Connectors folder', () => {
    expect(readVaultConnectors(vault())).toEqual({ found: [], errors: [] });
  });
  it('reports a folder missing either file and skips dot-folders', () => {
    const v = vault();
    put(v, 'Connectors/one/connector.json', '{}');
    put(v, 'Connectors/two/connector.js', 'x');
    put(v, 'Connectors/.hidden/connector.json', '{}');
    const r = readVaultConnectors(v);
    expect(r.found).toEqual([]);
    expect(r.errors.map((e) => e.path).sort()).toEqual(['Connectors/one', 'Connectors/two']);
  });
  it.each(['connector.js', 'connector.json'])('refuses a symlinked %s without reading it', (name) => {
    const v = vault();
    const secret = path.join(vault(), 'secret.txt');
    fs.writeFileSync(secret, 'TOPSECRET');
    put(v, 'Connectors/x-y/connector.json', '{}');
    put(v, 'Connectors/x-y/connector.js', 'x');
    fs.rmSync(path.join(v, 'Connectors/x-y', name));
    fs.symlinkSync(secret, path.join(v, 'Connectors/x-y', name));
    const r = readVaultConnectors(v);
    expect(r.found).toEqual([]);
    expect(r.errors).toHaveLength(1);
    expect(JSON.stringify(r)).not.toContain('TOPSECRET');
  });
  it('refuses a symlinked connector folder', () => {
    const v = vault();
    const other = vault();
    put(other, 'connector.json', '{}');
    put(other, 'connector.js', 'x');
    fs.mkdirSync(path.join(v, 'Connectors'));
    fs.symlinkSync(other, path.join(v, 'Connectors/linked'));
    const r = readVaultConnectors(v);
    expect(r.found).toEqual([]);
    expect(r.errors[0].path).toBe('Connectors/linked');
  });
});
