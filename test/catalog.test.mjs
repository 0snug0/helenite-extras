import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateCatalog } from '../scripts/catalog.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const base = { name: 'N', kind: 'plugin', description: 'D', author: 'A' };
const one = (e) => validateCatalog({ entries: [{ id: 'x', ...base, ...e }] });

test('keeps a valid path entry', () => {
  const r = one({ path: 'catalog/plugins/x/dist', files: ['manifest.json', 'main.js'] });
  assert.deepEqual(r.errors, []);
  assert.equal(r.entries.length, 1);
});

test('keeps a valid repo entry', () => {
  assert.equal(one({ repo: 'someone/their-plugin' }).entries.length, 1);
});

test('drops an entry with both path and repo, or neither', () => {
  assert.equal(one({ path: 'catalog/x', files: ['a'], repo: 'a/b' }).entries.length, 0);
  assert.equal(one({}).entries.length, 0);
});

test('drops path "../x", an absolute path and a path outside catalog/ and templates/', () => {
  for (const path of ['../x', 'catalog/../../x', '/etc', 'catalog//x', 'packages/ui']) {
    const r = one({ path, files: ['a'] });
    assert.equal(r.entries.length, 0, path);
    assert.equal(r.errors.length, 1, path);
  }
});

test('drops files ["../a"], ["/etc/passwd"], ["a\\\\b"] and an empty list', () => {
  for (const files of [['../a'], ['/etc/passwd'], ['a\\b'], ['ok', 'x/../../y'], []]) {
    assert.equal(one({ path: 'catalog/x', files }).entries.length, 0, JSON.stringify(files));
  }
});

test('drops files on a repo entry, an unknown kind, a bad id and a duplicate id', () => {
  assert.equal(one({ repo: 'a/b', files: ['x'] }).entries.length, 0);
  assert.equal(one({ kind: 'widget', repo: 'a/b' }).entries.length, 0);
  assert.equal(one({ id: 'Bad_Id', repo: 'a/b' }).entries.length, 0);
  const twice = validateCatalog({ entries: [{ id: 'x', ...base, repo: 'a/b' }, { id: 'x', ...base, repo: 'c/d' }] });
  assert.equal(twice.entries.length, 1);
  assert.equal(twice.errors.length, 1);
});

test('one bad entry does not take the others with it; a non-catalog is an error', () => {
  const r = validateCatalog({ entries: [{ id: 'good', ...base, repo: 'a/b' }, { id: 'bad', ...base }] });
  assert.deepEqual(r.entries.map((e) => e.id), ['good']);
  assert.equal(validateCatalog('nope').errors.length, 1);
  assert.equal(validateCatalog({}).errors.length, 1);
});

const catalog = JSON.parse(readFileSync(join(root, 'catalog.json'), 'utf8'));

test('every entry in the real catalog.json validates', () => {
  const r = validateCatalog(catalog);
  assert.deepEqual(r.errors, []);
  assert.equal(r.entries.length, catalog.entries.length);
});

test("the Media app's file list is the folder's files", () => {
  const entry = catalog.entries.find((e) => e.id === 'media');
  const dir = join(root, entry.path);
  const walk = (d) => readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : [relative(dir, join(d, n))]));
  assert.deepEqual([...entry.files].sort(), walk(dir).sort());
});

test('every catalog plugin has an entry, under its manifest id', () => {
  for (const d of readdirSync(join(root, 'catalog/plugins'))) {
    const m = JSON.parse(readFileSync(join(root, 'catalog/plugins', d, 'manifest.json'), 'utf8'));
    assert.ok(catalog.entries.some((e) => e.id === m.id && e.kind === 'plugin'), `no entry for ${m.id}`);
  }
});
