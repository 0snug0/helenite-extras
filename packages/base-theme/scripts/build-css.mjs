// Concatenates css/*.css (in filename order) into dist/base.css. The source is split only to keep files small.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

export function buildBaseCss() {
  const parts = readdirSync(join(root, 'css')).filter((f) => f.endsWith('.css')).sort();
  const out = join(root, 'dist/base.css');
  mkdirSync(dirname(out), { recursive: true });
  // The design-system part alone, for app frames (they get app-base.css, not the whole app shell stylesheet), with the
  // bundled Inter face first so a frame renders the same font as the host.
  const ds = ['00-inter.css', '06-design-system.css'].map((f) => readFileSync(join(root, 'css', f), 'utf8'));
  writeFileSync(join(root, 'dist/design-system.css'), ds.join('\n'));
  writeFileSync(out, parts.map((f) => readFileSync(join(root, 'css', f), 'utf8')).join('\n'));
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) console.log(buildBaseCss());
