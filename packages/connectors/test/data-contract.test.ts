import { describe, expect, it } from 'vitest';
import { checkSchema, parseContract, project, validate } from '../src/data';

const ok = (r: ReturnType<typeof parseContract>) => {
  if ('error' in r) throw new Error(r.error);
  return r.contract;
};

describe('parseContract', () => {
  it('treats a bare schema as records with no actions', () => {
    const schema = { type: 'object', properties: { id: { type: 'integer' } } };
    expect(ok(parseContract('radarr', JSON.stringify(schema)))).toEqual({ name: 'radarr', records: schema, actions: {} });
  });
  it('reads records and actions from a contract object', () => {
    const c = ok(parseContract('x', JSON.stringify({ records: { type: 'object' }, actions: { remove: { args: [{ type: 'integer' }] } } })));
    expect(c.records).toEqual({ type: 'object' });
    expect(c.actions.remove.args).toEqual([{ type: 'integer' }]);
  });
  it('rejects non-array action args', () => {
    const r = parseContract('x', JSON.stringify({ records: {}, actions: { remove: { args: {} } } }));
    expect('error' in r && r.error).toMatch(/remove/);
  });
  it('rejects invalid JSON', () => {
    expect(parseContract('x', '{nope')).toEqual({ error: 'x: not valid JSON' });
  });
  it('rejects a declared $source property', () => {
    const r = parseContract('x', JSON.stringify({ type: 'object', properties: { $source: { type: 'string' } } }));
    expect('error' in r && r.error).toContain('$source');
  });
  it('rejects unknown keywords, including in action args', () => {
    const a = parseContract('x', JSON.stringify({ type: 'string', format: 'uri' }));
    expect('error' in a && a.error).toContain('format');
    const b = parseContract('x', JSON.stringify({ records: {}, actions: { go: { args: [{ type: 'string', format: 'uri' }] } } }));
    expect('error' in b && b.error).toContain('format');
  });
});

describe('checkSchema', () => {
  it('walks items, additionalProperties and anyOf', () => {
    expect(checkSchema({ items: { properties: { $source: {} } } })[0]).toContain('$source');
    expect(checkSchema({ additionalProperties: { format: 'x' } })[0]).toContain('format');
    expect(checkSchema({ anyOf: [{ type: 'string' }, { foo: 1 }] })[0]).toContain('foo');
  });
  it('accepts a clean schema', () => {
    expect(checkSchema({ type: 'array', items: { type: 'object', properties: { id: { type: 'integer' } }, additionalProperties: false } })).toEqual([]);
  });
});

describe('validate', () => {
  it('still validates', () => {
    expect(validate({ id: 'a' }, { type: 'object', properties: { id: { type: 'integer' } } })).toHaveLength(1);
  });
});

describe('project', () => {
  it('drops undeclared keys', () => {
    expect(project({ id: 1, extra: 2 }, { type: 'object', properties: { id: { type: 'integer' } } })).toEqual({ id: 1 });
  });
  it('projects nested items.properties', () => {
    const schema = { type: 'array', items: { type: 'object', properties: { id: {} } } };
    expect(project([{ id: 1, x: 2 }, { id: 3, y: 4 }], schema)).toEqual([{ id: 1 }, { id: 3 }]);
  });
  it('keeps values under anyOf or object additionalProperties', () => {
    const v = { id: 1, extra: 2 };
    expect(project(v, { anyOf: [{ type: 'object', properties: { id: {} } }] })).toEqual(v);
    expect(project(v, { type: 'object', properties: { id: {} }, additionalProperties: { type: 'integer' } })).toEqual(v);
  });
  it('returns non-object values as-is', () => {
    expect(project(5, { type: 'object', properties: {} })).toBe(5);
    expect(project('s', {})).toBe('s');
  });
});
