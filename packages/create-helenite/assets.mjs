// What a template needs from Helenite besides its own files: the `helenite` module's types (plugin) and a bundle of
// @helenite/ui-kit (app), plus the multi-page shell (app-pages). In a Helenite checkout both are built fresh from the sources. A packed copy (`pnpm pack`
// runs vendor.mjs first) has no sources beside it, so it reads the copies vendor.mjs saved in vendor/.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../..');
const inRepo = existsSync(join(repoRoot, 'packages/types/build.mjs')) && existsSync(join(repoRoot, 'packages/ui-kit/src/index.ts'));
export const vendorDir = join(here, 'vendor');

function vendored(name) {
  const file = join(vendorDir, name);
  if (!existsSync(file)) throw new Error(`${file} is missing. Run create-helenite from a Helenite checkout, or pack it with pnpm pack (which writes vendor/).`);
  return readFileSync(file, 'utf8');
}

/** The text of `helenite.d.ts` (`declare module 'helenite'`), the types of `@helenite/types`. */
export function heleniteTypes() {
  if (!inRepo) return vendored('helenite.d.ts');
  try {
    execFileSync(process.execPath, [join(repoRoot, 'packages/types/build.mjs')], { stdio: 'pipe' });
  } catch (e) {
    throw new Error(`could not build @helenite/types:\n${e.stdout ?? ''}${e.stderr ?? ''}`);
  }
  return readFileSync(join(repoRoot, 'packages/types/dist/helenite.d.ts'), 'utf8');
}

/** The Helenite version the types describe, e.g. "0.1.0" (a plugin's manifest asks for `^` that). */
export function heleniteVersion(types) {
  const m = /HELENITE_VERSION = "(\d+\.\d+\.\d+)"/.exec(types);
  if (!m) throw new Error('helenite.d.ts does not declare HELENITE_VERSION');
  return m[1];
}

/** `@helenite/ui-kit` as one ES module, for an app to import as ./ui-kit.js (an app frame cannot resolve package names). */
export async function uiKitBundle() {
  if (!inRepo) return vendored('ui-kit.js');
  const { build } = await import('esbuild');
  const { version } = JSON.parse(readFileSync(join(repoRoot, 'packages/ui-kit/package.json'), 'utf8'));
  const out = await build({
    entryPoints: [join(repoRoot, 'packages/ui-kit/src/index.ts')],
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: 'chrome140',
    write: false,
    logLevel: 'warning',
  });
  return `// @helenite/ui-kit ${version}, bundled by create-helenite. Do not edit; to update it, scaffold a new app and copy its ui-kit.js.\n${out.outputFiles[0].text}`;
}

/** The multi-page shell of `--template app-pages`: router.js and shell.js, copied from templates/movie-tv/Apps/Media so the Media app stays the one source. */
export function pagesShell() {
  if (!inRepo) return { 'router.js': vendored('pages-router.js'), 'shell.js': vendored('pages-shell.js') };
  const media = join(repoRoot, 'templates/movie-tv/Apps/Media');
  return { 'router.js': readFileSync(join(media, 'router.js'), 'utf8'), 'shell.js': readFileSync(join(media, 'shell.js'), 'utf8') };
}
