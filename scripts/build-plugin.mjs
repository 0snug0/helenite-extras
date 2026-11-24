// Builds catalog plugins into <plugin>/dist: main.js (and accounts.js), manifest.json, optional styles.css.
// Usage: node scripts/build-plugin.mjs [plugin-id ...]   (no ids: every catalog/plugins/*)
// The same output as the app's plugins/core-build/build.mjs, with no core-* default.
import { build } from 'esbuild';
import { copyFile, mkdir, readdir, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const pluginsDir = resolve(dirname(fileURLToPath(import.meta.url)), '../catalog/plugins');
export const EXTERNAL = ['obsidian', 'helenite', 'electron', '@codemirror/*', '@lezer/*', 'moment'];

const exists = (p) => stat(p).then(() => true, () => false);

export async function buildPlugin(dir) {
  const out = join(dir, 'dist');
  await mkdir(out, { recursive: true });
  // A plugin has up to two entries: src/main.ts (vault features) and src/accounts.ts (its account type).
  for (const name of ['main', 'accounts']) {
    if (!(await exists(join(dir, `src/${name}.ts`)))) continue;
    await build({
      entryPoints: [join(dir, `src/${name}.ts`)],
      outfile: join(out, `${name}.js`),
      bundle: true,
      platform: 'node',
      format: 'cjs',
      target: 'chrome140',
      external: EXTERNAL,
      sourcemap: 'inline',
      logLevel: 'warning',
    });
  }
  await copyFile(join(dir, 'manifest.json'), join(out, 'manifest.json'));
  if (await exists(join(dir, 'styles.css'))) await copyFile(join(dir, 'styles.css'), join(out, 'styles.css'));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const only = process.argv.slice(2);
  const targets = only.length ? only : await readdir(pluginsDir);
  let built = 0;
  for (const n of targets) {
    const dir = join(pluginsDir, n);
    if (!(await exists(join(dir, 'src/main.ts'))) && !(await exists(join(dir, 'src/accounts.ts')))) continue;
    await buildPlugin(dir);
    built++;
  }
  console.log(`built ${built} plugins`);
}
