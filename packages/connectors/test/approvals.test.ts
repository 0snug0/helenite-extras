import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { connectorHash, createApprovals, type VaultConnectorFiles } from '../src/data';

const dirs: string[] = [];
const tmp = () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'ap-'));
  dirs.push(d);
  return d;
};
afterEach(() => dirs.splice(0).forEach((d) => fs.rmSync(d, { recursive: true, force: true })));

const files = (code = 'v1'): VaultConnectorFiles => ({ id: 'my-conn', path: 'Connectors/my-conn', manifestText: '{"id":"my-conn"}', code });
const A = 'https://a.example';
const B = 'https://b.example';

describe('createApprovals', () => {
  it('walks new -> approved -> host-changed -> approved -> changed', () => {
    const a = createApprovals(tmp(), 'k1');
    const f = files();
    const h = connectorHash(f.manifestText, f.code);
    expect(a.state(f.path, h, [A])).toBe('new');
    a.decide(f, 'approved', [A]);
    expect(a.state(f.path, h, [A])).toBe('approved');
    expect(a.state(f.path, h, [A, B])).toBe('host-changed');
    a.allowOrigin(f.path, B);
    expect(a.state(f.path, h, [A, B])).toBe('approved');
    expect(a.state(f.path, connectorHash(f.manifestText, 'v2'), [A])).toBe('changed');
  });
  it('records a rejection without writing the approved copy', () => {
    const dir = tmp();
    const a = createApprovals(dir, 'k1');
    const f = files();
    a.decide(f, 'rejected', [A]);
    expect(a.state(f.path, connectorHash(f.manifestText, f.code), [A])).toBe('rejected');
    expect(a.previous(f.path)).toBeNull();
    expect(a.record(f.path)?.decision).toBe('rejected');
  });
  it('changed outranks rejected; previous keeps the last approved copy through a later rejection', () => {
    const a = createApprovals(tmp(), 'k1');
    a.decide(files('v1'), 'approved', [A]);
    a.decide(files('v2'), 'rejected', [A]);
    expect(a.state('Connectors/my-conn', connectorHash(files('v1').manifestText, 'v1'), [A])).toBe('changed');
    expect(a.previous('Connectors/my-conn')).toEqual({ manifestText: files().manifestText, code: 'v1' });
  });
  it('previous returns what decide wrote', () => {
    const a = createApprovals(tmp(), 'k1');
    expect(a.previous('Connectors/my-conn')).toBeNull();
    a.decide(files('v1'), 'approved', [A]);
    a.decide(files('v2'), 'approved', [A]);
    expect(a.previous('Connectors/my-conn')?.code).toBe('v2');
  });
  it('allowOrigin on an unapproved path is a no-op', () => {
    const dir = tmp();
    const a = createApprovals(dir, 'k1');
    a.allowOrigin('Connectors/none', A);
    expect(a.record('Connectors/none')).toBeNull();
    expect(fs.existsSync(path.join(dir, 'connector-approvals.json'))).toBe(false);
    a.decide(files(), 'rejected', []);
    a.allowOrigin('Connectors/my-conn', A);
    expect(a.record('Connectors/my-conn')?.origins).toEqual([]);
  });
  it('isolates vault keys', () => {
    const dir = tmp();
    const f = files();
    createApprovals(dir, 'k1').decide(f, 'approved', [A]);
    const other = createApprovals(dir, 'k2');
    expect(other.state(f.path, connectorHash(f.manifestText, f.code), [A])).toBe('new');
    expect(other.previous(f.path)).toBeNull();
    expect(createApprovals(dir, 'k1').record(f.path)?.decision).toBe('approved');
  });
  it('stores under the documented key and writes nothing in the vault', () => {
    const dir = tmp();
    const vault = tmp();
    createApprovals(dir, 'k1').decide(files(), 'approved', [A]);
    const all = JSON.parse(fs.readFileSync(path.join(dir, 'connector-approvals.json'), 'utf8'));
    expect(Object.keys(all)).toEqual(['k1/Connectors/my-conn']);
    expect(all['k1/Connectors/my-conn']).toMatchObject({ decision: 'approved', origins: [A] });
    expect(fs.existsSync(path.join(dir, 'connector-approvals/k1/my-conn/connector.js'))).toBe(true);
    expect(fs.readdirSync(vault)).toEqual([]);
  });
  it('treats a corrupt store as empty and ignores malformed records', () => {
    const dir = tmp();
    fs.writeFileSync(path.join(dir, 'connector-approvals.json'), '{nope');
    expect(createApprovals(dir, 'k1').record('Connectors/my-conn')).toBeNull();
    fs.writeFileSync(path.join(dir, 'connector-approvals.json'), JSON.stringify({ 'k1/Connectors/my-conn': { hash: 1 } }));
    expect(createApprovals(dir, 'k1').state('Connectors/my-conn', 'h', [])).toBe('new');
  });
  it('does not resolve prototype keys and refuses unsafe paths', () => {
    const a = createApprovals(tmp(), 'k1');
    expect(a.record('constructor')).toBeNull();
    expect(a.record('__proto__')).toBeNull();
    expect(a.previous('Connectors/../../x')).toBeNull();
    expect(() => a.decide({ ...files(), id: '..', path: 'Connectors/..' }, 'approved', [])).toThrow();
    expect(() => createApprovals(tmp(), '../x')).toThrow();
  });
});
