import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDataService, loadTemplateContracts, parseContract, readDataFile, writeDataFile, type Contract, type DataFile, type DataSource, type SourceError } from '../src/data';

const contract = (text: object): Contract => {
  const r = parseContract('download-queue', JSON.stringify(text));
  if ('error' in r) throw new Error(r.error);
  return r.contract;
};
const QUEUE = contract({
  records: { type: 'object', required: ['id', 'title'], properties: { id: { type: 'integer' }, title: { type: 'string' } } },
  actions: { remove: { args: [{ type: 'boolean' }] }, pause: { args: [] } },
});

const good = (id: number) => ({ id, title: `t${id}`, extra: 'dropped' });
function source(id: string, over: Partial<DataSource> & { list?: () => unknown } = {}) {
  const invoke = vi.fn(async (method: string, args: unknown[]) => (method === 'getQueue' ? (over.list ? over.list() : []) : { method, args }));
  const src: DataSource = { id, status: 'ready', provides: { 'download-queue': { list: 'getQueue', actions: { remove: 'removeItem' } } }, invoke, ...over };
  return Object.assign(src, { invoke });
}
function setup(sources: DataSource[], bound = sources.map((s) => s.id), contracts: Map<string, any> = new Map([['download-queue', QUEUE]])) {
  const errors: [string, SourceError][] = [];
  const data: DataFile = { bindings: { 'download-queue': bound }, settings: {} };
  const svc = createDataService({
    contracts: () => contracts,
    data: () => data,
    source: (id) => {
      const s = sources.find((x) => x.id === id);
      if (!s) throw new Error('nope');
      return s;
    },
    onError: (c, e) => errors.push([c, e]),
  });
  return { svc, errors, data };
}

describe('list', () => {
  it('merges sources in binding order, projects and tags $source', async () => {
    const a = source('a', { list: () => [good(1)] });
    const b = source('b', { list: () => [good(2)] });
    const { svc } = setup([b, a], ['a', 'b']);
    const r = await svc.list('download-queue');
    expect(r.errors).toEqual([]);
    expect(r.records).toEqual([{ id: 1, title: 't1', $source: 'a' }, { id: 2, title: 't2', $source: 'b' }]);
  });

  it('drops invalid records and reports them', async () => {
    const a = source('a', { list: () => [good(1), { id: 'x' }, good(2), null, 5] });
    const { svc, errors } = setup([a]);
    const r = await svc.list('download-queue');
    expect(r.records.map((x) => x.id)).toEqual([1, 2]);
    expect(r.errors).toEqual([{ source: 'a', kind: 'invalid', dropped: 3, message: "a: 3 records didn't match download-queue: $: missing required \"title\"" }]);
    expect(errors).toEqual([['download-queue', r.errors[0]]]);
  });

  it('says "record" for one bad record', async () => {
    const { svc } = setup([source('a', { list: () => [{ id: 1 }] })]);
    const r = await svc.list('download-queue');
    expect(r.errors[0].message).toMatch(/^a: 1 record didn't match download-queue: /);
  });

  it('keeps going when one source throws', async () => {
    const a = source('a', { list: () => { throw new Error('boom'); } });
    const b = source('b', { list: () => [good(2)] });
    const { svc } = setup([a, b]);
    const r = await svc.list('download-queue');
    expect(r.records).toEqual([{ id: 2, title: 't2', $source: 'b' }]);
    expect(r.errors).toEqual([{ source: 'a', kind: 'failed', message: 'boom' }]);
  });

  it.each([[null], [{}], ['x'], [7]])('reports a non-array list result (%j) as invalid', async (value) => {
    const { svc } = setup([source('a', { list: () => value })]);
    const r = await svc.list('download-queue');
    expect(r.records).toEqual([]);
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toMatchObject({ source: 'a', kind: 'invalid' });
  });

  it.each([['waiting-review'], ['rejected'], ['missing']] as const)('never invokes a %s source', async (status) => {
    const a = source('a', { status });
    const { svc } = setup([a]);
    const r = await svc.list('download-queue');
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0].kind).toBe(status);
    expect(a.invoke).not.toHaveBeenCalled();
  });

  it('skips a source that does not provide the contract', async () => {
    const a = source('a', { provides: {} });
    const { svc } = setup([a]);
    const r = await svc.list('download-queue');
    expect(r.errors).toEqual([{ source: 'a', kind: 'failed', message: "a doesn't provide download-queue" }]);
    expect(a.invoke).not.toHaveBeenCalled();
  });

  it('does not reach prototype members through provides', async () => {
    const a = source('a', { provides: {} });
    const bound = { bindings: { constructor: ['a'] }, settings: {} };
    const svc2 = createDataService({ contracts: () => new Map([['constructor', { ...QUEUE, name: 'constructor' }]]), data: () => bound, source: () => a });
    expect((await svc2.list('constructor')).errors[0].kind).toBe('failed');
    expect(a.invoke).not.toHaveBeenCalled();
  });

  it('throws unavailable for unknown or broken contracts', async () => {
    const { svc } = setup([], [], new Map([['broken', { error: 'broken: not valid JSON' }]]));
    await expect(svc.list('nope')).rejects.toMatchObject({ code: 'unavailable' });
    await expect(svc.list('broken')).rejects.toMatchObject({ code: 'unavailable', message: 'broken: not valid JSON' });
  });

  it('keeps an own __proto__ key in a record as data', async () => {
    const hostile = JSON.parse('{"id":1,"title":"t","__proto__":{"polluted":true}}');
    const c = contract({ type: 'object', properties: { id: { type: 'integer' }, title: { type: 'string' }, __proto__: { type: 'object' } } });
    const { svc } = setup([source('a', { list: () => [hostile] })], ['a'], new Map([['download-queue', c]]));
    const r = await svc.list('download-queue');
    expect(({} as any).polluted).toBeUndefined();
    expect(Object.getPrototypeOf(r.records[0])).toBe(Object.prototype);
  });
});

describe('act', () => {
  const rec = { id: 1, title: 't1', $source: 'a' };
  it('routes by $source and strips it', async () => {
    const a = source('a');
    const b = source('b');
    const { svc } = setup([a, b]);
    const out = await svc.act('download-queue', 'remove', rec, [true]);
    expect(out).toEqual({ method: 'removeItem', args: [{ id: 1, title: 't1' }, true] });
    expect(b.invoke).not.toHaveBeenCalled();
  });

  it('rejects wrong arg count or type as bad-request', async () => {
    const a = source('a');
    const { svc } = setup([a]);
    await expect(svc.act('download-queue', 'remove', rec, [])).rejects.toMatchObject({ code: 'bad-request' });
    await expect(svc.act('download-queue', 'remove', rec, ['yes'])).rejects.toMatchObject({ code: 'bad-request' });
    expect(a.invoke).not.toHaveBeenCalled();
  });

  it('rejects an invalid record, a missing/unbound $source, and unknown actions as bad-request', async () => {
    const a = source('a');
    const { svc } = setup([a]);
    await expect(svc.act('download-queue', 'remove', { id: 'x', title: 't', $source: 'a' }, [true])).rejects.toMatchObject({ code: 'bad-request' });
    await expect(svc.act('download-queue', 'remove', { id: 1, title: 't' }, [true])).rejects.toMatchObject({ code: 'bad-request' });
    await expect(svc.act('download-queue', 'remove', { ...rec, $source: 'z' }, [true])).rejects.toMatchObject({ code: 'bad-request' });
    await expect(svc.act('download-queue', 'remove', null, [true])).rejects.toMatchObject({ code: 'bad-request' });
    await expect(svc.act('download-queue', 'constructor', rec, [])).rejects.toMatchObject({ code: 'bad-request' });
    await expect(svc.act('download-queue', '__proto__', rec, [])).rejects.toMatchObject({ code: 'bad-request' });
    expect(a.invoke).not.toHaveBeenCalled();
  });

  it("reports an action the source doesn't implement as unsupported", async () => {
    const a = source('a');
    const { svc } = setup([a]);
    await expect(svc.act('download-queue', 'pause', rec, [])).rejects.toMatchObject({ code: 'unsupported', message: "a can't pause" });
    expect(a.invoke).not.toHaveBeenCalled();
  });

  it('rejects when the source is no longer approved', async () => {
    const a = source('a', { status: 'waiting-review' });
    const { svc } = setup([a]);
    await expect(svc.act('download-queue', 'remove', rec, [true])).rejects.toMatchObject({ code: 'waiting-review' });
    const r = source('a', { status: 'rejected' });
    await expect(setup([r]).svc.act('download-queue', 'remove', rec, [true])).rejects.toMatchObject({ code: 'unavailable' });
    expect(a.invoke).not.toHaveBeenCalled();
    expect(r.invoke).not.toHaveBeenCalled();
  });

  it('throws unavailable for an unknown contract', async () => {
    await expect(setup([]).svc.act('nope', 'x', rec, [])).rejects.toMatchObject({ code: 'unavailable' });
  });
});

describe('contracts', () => {
  it('lists actions and binding statuses', () => {
    const { svc } = setup([source('a'), source('b', { status: 'waiting-review' })], ['a', 'b', 'ghost']);
    expect(svc.contracts(['download-queue', 'nope'])).toEqual([
      { name: 'download-queue', actions: ['remove', 'pause'], sources: [{ id: 'a', status: 'ready' }, { id: 'b', status: 'waiting-review' }, { id: 'ghost', status: 'missing' }] },
      { name: 'nope', actions: [], error: 'No contract named nope.', sources: [] },
    ]);
  });
});

describe('data file', () => {
  const dirs: string[] = [];
  const tmp = () => { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'dsvc-')); dirs.push(d); return d; };
  afterEach(() => { for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true }); });

  it('reads missing or invalid files as empty', () => {
    const d = tmp();
    expect(readDataFile(d)).toEqual({ bindings: {}, settings: {} });
    fs.mkdirSync(path.join(d, '.helenite'));
    fs.writeFileSync(path.join(d, '.helenite/data.json'), '{nope');
    expect(readDataFile(d)).toEqual({ bindings: {}, settings: {} });
  });

  it('round-trips and tolerates junk', () => {
    const d = tmp();
    writeDataFile(d, { bindings: { q: ['a', 'b'] }, settings: { a: { url: 'http://x', n: 1 } } });
    expect(readDataFile(d)).toEqual({ bindings: { q: ['a', 'b'] }, settings: { a: { url: 'http://x', n: 1 } } });
    fs.writeFileSync(path.join(d, '.helenite/data.json'), JSON.stringify({ bindings: { q: ['a', 3, null], bad: 'x', obj: {} }, settings: { a: { ok: 'y', no: {} }, b: 4 } }));
    expect(readDataFile(d)).toEqual({ bindings: { q: ['a'] }, settings: { a: { ok: 'y' } } });
  });

  it('loads template contracts and confines paths to the vault', () => {
    const d = tmp();
    expect(loadTemplateContracts(d).size).toBe(0);
    fs.mkdirSync(path.join(d, 'contracts'));
    fs.writeFileSync(path.join(d, 'contracts/q.json'), JSON.stringify({ type: 'object' }));
    const outside = tmp();
    fs.writeFileSync(path.join(outside, 'o.json'), '{}');
    fs.symlinkSync(path.join(outside, 'o.json'), path.join(d, 'link.json'));
    fs.symlinkSync(outside, path.join(d, 'linkdir'));
    fs.writeFileSync(path.join(d, 'helenite-template.json'), JSON.stringify({ data: { ok: 'contracts/q.json', abs: path.join(outside, 'o.json'), up: '../x.json', up2: 'contracts/../../x.json', link: 'link.json', viaDir: 'linkdir/o.json', missing: 'nope.json', num: 3, bad: 'helenite-template.json' } }));
    const m = loadTemplateContracts(d);
    expect(m.get('ok')).toEqual({ name: 'ok', records: { type: 'object' }, actions: {} });
    for (const k of ['abs', 'up', 'up2', 'link', 'viaDir', 'missing', 'num']) expect(m.get(k), k).toHaveProperty('error');
    expect(m.get('bad')).toHaveProperty('error');
  });
});
