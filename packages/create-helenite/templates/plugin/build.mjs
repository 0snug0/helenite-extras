// Bundles src/main.ts into dist/main.js and copies manifest.json (and styles.css) beside it: dist/ is the folder
// that goes into a vault's plugins folder. `obsidian` and `helenite` are provided by the app at run time.
import { build } from 'esbuild';
import { copyFile, mkdir, stat } from 'node:fs/promises';

const exists = (p) => stat(p).then(() => true, () => false);

await mkdir('dist', { recursive: true });
await build({
  entryPoints: ['src/main.ts'],
  outfile: 'dist/main.js',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'chrome140',
  external: ['obsidian', 'helenite', 'electron', '@codemirror/*', '@lezer/*'],
  sourcemap: 'inline',
  logLevel: 'warning',
});
await copyFile('manifest.json', 'dist/manifest.json');
if (await exists('styles.css')) await copyFile('styles.css', 'dist/styles.css');
console.log('built dist/main.js');
