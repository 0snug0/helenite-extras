#!/usr/bin/env node
// create-helenite: scaffolds a Helenite plugin, theme or vault app from templates/<template>.
// Guide: docs/dev/getting-started.md in the Helenite repository.
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { heleniteTypes, heleniteVersion, uiKitBundle } from './assets.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const TEMPLATES = ['plugin', 'theme', 'app'];
// The vault app id rule (apps-runtime's APP_ID), used for every template: lowercase letters, digits and hyphens.
const ID = /^[a-z][a-z0-9-]{1,40}$/;
// The name lands in JSON, YAML and folder names: no quotes, backslashes, path separators or control characters.
const BAD_NAME = /["\\/:*?<>|\u0000-\u001f]|\{\{/;
const USAGE = 'Usage: node packages/create-helenite/bin.mjs <dir> --template plugin|theme|app [--name "My thing"] [--id my-thing]';

function fail(message) {
  console.error(`create-helenite: ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  const out = { dir: null, template: null, name: null, id: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-h' || a === '--help') {
      console.log(USAGE);
      process.exit(0);
    }
    const m = /^--(template|name|id)(?:=(.*))?$/.exec(a);
    if (m) {
      const value = m[2] ?? argv[++i];
      if (value === undefined || value === '') fail(`--${m[1]} needs a value.\n${USAGE}`);
      out[m[1]] = value;
    } else if (a.startsWith('-')) fail(`unknown option ${a}.\n${USAGE}`);
    else if (out.dir) fail(`one directory only (got ${out.dir} and ${a}).\n${USAGE}`);
    else out.dir = a;
  }
  if (!out.dir) fail(`name the directory to create.\n${USAGE}`);
  if (!TEMPLATES.includes(out.template)) fail(`--template must be one of ${TEMPLATES.join(', ')}.\n${USAGE}`);
  return out;
}

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const titleOf = (id) => id.split('-').filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');

function names(args) {
  const id = args.id ?? slug(args.name ?? basename(resolve(args.dir)));
  if (!ID.test(id)) fail(`"${id}" is not a valid id: use 2 to 41 lowercase letters, digits and hyphens, starting with a letter (--id my-thing).`);
  if (args.template === 'plugin' && id.startsWith('core-')) fail(`"${id}" starts with core-, which Helenite keeps for its built-in plugins.`);
  const name = (args.name ?? titleOf(id)).trim();
  if (!name || BAD_NAME.test(name)) fail(`"${name}" is not a valid name: leave out quotes, backslashes, slashes and : * ? < > |.`);
  return { id, name };
}

function ensureEmpty(dir) {
  if (!existsSync(dir)) return;
  if (!statSync(dir).isDirectory()) fail(`${dir} exists and is not a directory.`);
  if (readdirSync(dir).length) fail(`${dir} is not empty. Pick a new directory; create-helenite never overwrites files.`);
}

/** Every file under `dir`, recursively. */
function files(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(join(dir, e.name)) : [join(dir, e.name)]));
}

const args = parseArgs(process.argv.slice(2));
const { id, name } = names(args);
const dest = resolve(args.dir);
ensureEmpty(dest);

const vars = { id, name };
const extra = {};
if (args.template === 'plugin') {
  const types = heleniteTypes();
  vars.helenite = `^${heleniteVersion(types)}`;
  extra['types/helenite.d.ts'] = types;
}
if (args.template === 'app') extra['ui-kit.js'] = await uiKitBundle();

mkdirSync(dest, { recursive: true });
cpSync(join(here, 'templates', args.template), dest, { recursive: true });
for (const file of files(dest)) {
  const text = readFileSync(file, 'utf8');
  const filled = text.replace(/\{\{(id|name|helenite)\}\}/g, (_, k) => vars[k] ?? fail(`template ${relative(dest, file)} uses {{${k}}}, which ${args.template} does not set`));
  if (filled !== text) writeFileSync(file, filled);
}
// npm pack leaves out files named .gitignore, so the templates carry it as `gitignore`.
if (existsSync(join(dest, 'gitignore'))) renameSync(join(dest, 'gitignore'), join(dest, '.gitignore'));
for (const [rel, text] of Object.entries(extra)) {
  mkdirSync(dirname(join(dest, rel)), { recursive: true });
  writeFileSync(join(dest, rel), text);
}

const rel = relative(process.cwd(), dest);
const shown = rel && !rel.startsWith('..') ? rel : dest;
const next = {
  plugin: [
    `  cd ${shown}`,
    '  npm install',
    '  npm run build      # writes dist/main.js and dist/manifest.json',
    '  npm test',
    '',
    `Then copy dist/ into <Home>/.obsidian/plugins/${id}/ (or <vault>/.helenite/plugins/${id}/),`,
    'restart Helenite and turn the plugin on in Settings, Community plugins.',
  ],
  theme: [
    `  Copy ${shown}/ to <Home>/.obsidian/themes/${name}/ (or <vault>/.helenite/themes/${name}/),`,
    `  then pick "${name}" in Settings, Appearance.`,
  ],
  app: [
    `  Copy ${shown}/ to <vault>/Apps/${name}/, approve its permissions,`,
    '  and open it with the command "Apps: Open app…".',
  ],
}[args.template];
console.log(`Created ${args.template} "${name}" (${id}) in ${shown}\n\nNext:\n${next.join('\n')}\n\nGuide: docs/dev/getting-started.md`);
