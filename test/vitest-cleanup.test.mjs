// scripts/vitest-cleanup.mjs without the app around it, and every vitest config using it.
import assert from 'node:assert/strict';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repo = fileURLToPath(new URL('..', import.meta.url));

test('a standalone clone gets a temp folder per run, removed at the end', async () => {
  // Copied two folders deep into an empty one, so there is no app above it.
  const clone = mkdtempSync(join(tmpdir(), 'xclean-'));
  const before = process.env.TMPDIR;
  try {
    mkdirSync(join(clone, 'extras/scripts'), { recursive: true });
    const copy = join(clone, 'extras/scripts/vitest-cleanup.mjs');
    copyFileSync(join(repo, 'scripts/vitest-cleanup.mjs'), copy);
    const { default: setup } = await import(pathToFileURL(copy).href);
    const teardown = await setup({});
    const run = tmpdir();
    assert.match(run, /hlx-[A-Za-z0-9]{6}$/);
    writeFileSync(join(mkdtempSync(join(tmpdir(), 'left-')), 'file'), '');
    teardown();
    assert.equal(existsSync(run), false);
    assert.equal(process.env.TMPDIR, before);
  } finally {
    rmSync(clone, { recursive: true, force: true });
  }
});

test('every vitest config uses it', () => {
  const missing = [];
  for (const group of ['packages', 'catalog/plugins']) {
    for (const pkg of readdirSync(join(repo, group), { withFileTypes: true }).filter((e) => e.isDirectory())) {
      const dir = join(repo, group, pkg.name);
      const names = readdirSync(dir);
      const configs = names.filter((n) => /^vitest.*\.config\.m?ts$/.test(n));
      for (const n of configs) if (!readFileSync(join(dir, n), 'utf8').includes('/scripts/vitest-cleanup.mjs')) missing.push(`${group}/${pkg.name}/${n}`);
      // A package without one would silently run without the cleanup.
      if (!configs.length && names.includes('package.json') && /"test[^"]*":\s*"[^"]*vitest/.test(readFileSync(join(dir, 'package.json'), 'utf8'))) missing.push(`${group}/${pkg.name} (no config)`);
    }
  }
  assert.deepEqual(missing, []);
});
