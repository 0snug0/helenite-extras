// Usage: node scripts/release.mjs <tag>
// Builds every catalog/plugins/<dir> into dist/, points that plugin's catalog.json entry at the dist folder with the
// files that were written, commits (dist is git-ignored, so it is added by force) and tags <tag>.
// Push with `git push --follow-tags`, then `gh release create <tag>`: the app reads catalog.json at the latest release tag.
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPlugin, pluginsDir } from './build-plugin.mjs';
import { validateCatalog } from './catalog.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const tag = process.argv[2];
if (!tag || !/^v\d+\.\d+\.\d+/.test(tag)) {
  console.error('usage: node scripts/release.mjs vX.Y.Z');
  process.exit(1);
}
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
if (git('status', '--porcelain') !== '') {
  console.error('the working tree has changes: commit or stash them first');
  process.exit(1);
}

const catalogFile = join(root, 'catalog.json');
const catalog = JSON.parse(readFileSync(catalogFile, 'utf8'));
for (const dir of readdirSync(pluginsDir)) {
  const pluginDir = join(pluginsDir, dir);
  if (!existsSync(join(pluginDir, 'manifest.json'))) continue;
  const manifest = JSON.parse(readFileSync(join(pluginDir, 'manifest.json'), 'utf8'));
  await buildPlugin(pluginDir);
  const files = readdirSync(join(pluginDir, 'dist')).filter((f) => f === 'manifest.json' || f === 'styles.css' || f.endsWith('.js')).sort();
  const entry = catalog.entries.find((e) => e.id === manifest.id);
  if (!entry) throw new Error(`catalog.json has no entry for plugin ${manifest.id} (catalog/plugins/${dir})`);
  entry.path = relative(root, join(pluginDir, 'dist'));
  entry.files = files;
}
const { errors } = validateCatalog(catalog);
if (errors.length) throw new Error(`catalog.json is invalid:\n${errors.join('\n')}`);
writeFileSync(catalogFile, JSON.stringify(catalog, null, 2) + '\n');

git('add', 'catalog.json');
for (const e of catalog.entries) if (e.path?.endsWith('/dist')) git('add', '-f', e.path);
git('commit', '-m', `release ${tag}`);
git('tag', tag);
console.log(`released ${tag}: ${catalog.entries.filter((e) => e.path?.endsWith('/dist')).length} plugins built`);
