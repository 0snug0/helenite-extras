#!/usr/bin/env node
// create-helenite: scaffolds a Helenite plugin, theme, vault app or multi-page vault app from templates/<template>.
// Guide: docs/dev/getting-started.md in the Helenite repository.
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { heleniteTypes, heleniteVersion, pagesShell, uiKitBundle } from './assets.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const TEMPLATES = ['plugin', 'theme', 'app', 'app-pages', 'app-vite'];
// app-vite: the framework adapters (templates/app-vite/adapters/<name>). Adding one is adding a folder.
const FRAMEWORKS = existsSync(join(here, 'templates/app-vite/adapters')) ? readdirSync(join(here, 'templates/app-vite/adapters')) : [];
// app-vite layers, the same shape as adapters: a folder under styles/ (a CSS framework) or design-systems/ (components and
// tokens) holding layer.json ({ name, description, frameworks?, cssImports? }), files/ (copied over the project) and
// frameworks/<adapter>/ (copied over it for that adapter only). `--style` / `--design-system` take a folder name or a path.
const LAYER_KINDS = { style: 'styles', designSystem: 'design-systems' };
const layersOf = (kind) => {
  const dir = join(here, 'templates/app-vite', LAYER_KINDS[kind]);
  return existsSync(dir) ? readdirSync(dir).filter((n) => existsSync(join(dir, n, 'layer.json'))) : [];
};
function findLayer(kind, value, framework) {
  const flag = kind === 'style' ? '--style' : '--design-system';
  const dir = layersOf(kind).includes(value) ? join(here, 'templates/app-vite', LAYER_KINDS[kind], value) : resolve(value);
  if (!existsSync(join(dir, 'layer.json'))) fail(`${flag} must be one of ${['none', ...layersOf(kind)].join(', ')} or a folder holding layer.json (got "${value}").`);
  const meta = JSON.parse(readFileSync(join(dir, 'layer.json'), 'utf8'));
  if (meta.frameworks && !meta.frameworks.includes(framework)) fail(`${flag} ${meta.name ?? value} supports ${meta.frameworks.join(', ')}, not ${framework}.`);
  return { dir, meta };
}
// The vault app id rule (apps-runtime's APP_ID), used for every template: lowercase letters, digits and hyphens.
const ID = /^[a-z][a-z0-9-]{1,40}$/;
// The name is a folder name for themes and apps, so no slash and no leading dot; and no control characters or line
// separators (U+2028, U+2029). Quotes, backslashes and the like are fine: each place a name lands escapes it.
const BAD_NAME = /[/\u0000-\u001f\u007f\u2028\u2029]|^\./;
const USAGE = 'Usage: node packages/create-helenite/bin.mjs <dir> --template plugin|theme|app|app-pages|app-vite [--name "My thing"] [--id my-thing] [--framework preact] [--style none|tailwind] [--design-system none|modern] [--app-dir <vault>/Apps/My\ Thing]';

function fail(message) {
  console.error(`create-helenite: ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  const out = { dir: null, template: null, name: null, id: null, framework: 'preact', appDir: null, style: 'none', designSystem: 'none', list: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-h' || a === '--help') {
      console.log(USAGE);
      process.exit(0);
    }
    if (a === '--list') {
      out.list = true;
      continue;
    }
    const m = /^--(template|name|id|framework|app-dir|style|design-system)(?:=(.*))?$/.exec(a);
    if (m) {
      const value = m[2] ?? argv[++i];
      if (value === undefined || value === '') fail(`--${m[1]} needs a value.\n${USAGE}`);
      out[{ 'app-dir': 'appDir', 'design-system': 'designSystem' }[m[1]] ?? m[1]] = value;
    } else if (a.startsWith('-')) fail(`unknown option ${a}.\n${USAGE}`);
    else if (out.dir) fail(`one directory only (got ${out.dir} and ${a}).\n${USAGE}`);
    else out.dir = a;
  }
  if (out.list) {
    const row = (kind) => layersOf(kind).map((n) => `${n}: ${JSON.parse(readFileSync(join(here, 'templates/app-vite', LAYER_KINDS[kind], n, 'layer.json'), 'utf8')).description ?? ''}`);
    console.log(['frameworks:', ...FRAMEWORKS.map((f) => `  ${f}`), 'styles (CSS frameworks):', '  none: plain CSS over the theme variables', ...row('style').map((r) => `  ${r}`), 'design systems:', '  none: no component set', ...row('designSystem').map((r) => `  ${r}`)].join('\n'));
    process.exit(0);
  }
  if (!out.dir) fail(`name the directory to create.\n${USAGE}`);
  if (!TEMPLATES.includes(out.template)) fail(`--template must be one of ${TEMPLATES.join(', ')}.\n${USAGE}`);
  if (out.appDir && out.template !== 'app-vite') fail(`--app-dir is for --template app-vite.\n${USAGE}`);
  if (out.template !== 'app-vite' && (out.style !== 'none' || out.designSystem !== 'none')) fail(`--style and --design-system are for --template app-vite.\n${USAGE}`);
  if (!FRAMEWORKS.includes(out.framework)) fail(`--framework must be one of ${FRAMEWORKS.join(', ')}.\n${USAGE}`);
  if (out.template === 'app-vite') for (const [kind, v] of [['style', out.style], ['designSystem', out.designSystem]]) if (v !== 'none') findLayer(kind, v, out.framework); // fail before anything is written
  return out;
}

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const titleOf = (id) => id.split('-').filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');

function names(args) {
  const id = args.id ?? slug(args.name ?? basename(resolve(args.dir)));
  if (!ID.test(id)) fail(`"${id}" is not a valid id: use 2 to 41 lowercase letters, digits and hyphens, starting with a letter (--id my-thing).`);
  if (args.template === 'plugin' && id.startsWith('core-')) fail(`"${id}" starts with core-, which Helenite keeps for its built-in plugins.`);
  const name = (args.name ?? titleOf(id)).trim();
  if (!name || BAD_NAME.test(name)) fail(`${JSON.stringify(name)} is not a valid name: leave out slashes, line breaks and control characters, and do not start it with a dot.`);
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

// Placeholders: {{name}} is for prose (Markdown, comments that end at the line); the others escape it for where it lands.
const vars = {
  id,
  name,
  nameJs: JSON.stringify(name), // a JS/TS string literal, quotes included
  nameJson: JSON.stringify(name), // a JSON string, quotes included
  nameYaml: JSON.stringify(name), // a YAML double-quoted scalar (JSON's escapes are YAML's), quotes included
  nameCss: name.replaceAll('*/', '* /'), // inside a CSS /* comment */
};
const extra = {};
if (args.template === 'plugin') {
  const types = heleniteTypes();
  vars.helenite = `^${heleniteVersion(types)}`;
  extra['types/helenite.d.ts'] = types;
}
if (args.template === 'app' || args.template === 'app-pages') extra['ui-kit.js'] = await uiKitBundle();
if (args.template === 'app-pages') Object.assign(extra, pagesShell());

mkdirSync(dest, { recursive: true });
if (args.template === 'app-vite') {
  // The shared base, then the chosen adapter over it; their package.json files merge (the adapter adds its dependencies).
  const adapter = join(here, 'templates/app-vite/adapters', args.framework);
  cpSync(join(here, 'templates/app-vite/base'), dest, { recursive: true });
  cpSync(adapter, dest, { recursive: true, filter: (src) => basename(src) !== 'package.json' });
  const pkgFile = join(dest, 'package.json');
  const pkg = JSON.parse(readFileSync(pkgFile, 'utf8'));
  Object.assign(pkg, JSON.parse(readFileSync(join(adapter, 'package.json'), 'utf8')));
  // Layers over the adapter: the CSS framework, then the design system (which may replace App/main with a starter that uses it).
  // Each layer's package.json dependencies merge in; its cssImports become @import lines at the top of src/style.css.
  const imports = [];
  for (const [kind, value] of [['style', args.style], ['designSystem', args.designSystem]]) {
    if (value === 'none') continue;
    const { dir, meta } = findLayer(kind, value, args.framework);
    for (const sub of [join(dir, 'files'), join(dir, 'frameworks', args.framework)]) {
      if (!existsSync(sub)) continue;
      cpSync(sub, dest, { recursive: true, filter: (src) => basename(src) !== 'package.json' });
      if (existsSync(join(sub, 'package.json'))) {
        const add = JSON.parse(readFileSync(join(sub, 'package.json'), 'utf8'));
        for (const k of Object.keys(add)) pkg[k] = typeof add[k] === 'object' ? { ...pkg[k], ...add[k] } : add[k];
      }
    }
    imports.push(...(meta.cssImports ?? []));
  }
  writeFileSync(pkgFile, `${JSON.stringify(pkg, null, 2)}\n`);
  if (imports.length) {
    const css = join(dest, 'src/style.css');
    writeFileSync(css, `${imports.map((i) => `@import "./${i}";`).join('\n')}\n${readFileSync(css, 'utf8')}`);
  }
  // --app-dir: the project (node_modules, src) lives outside the vault, which indexes everything under it; `npm run build`
  // writes view.js, view.css and app.md into the app folder in the vault. app.md is written now so the app is listed at once.
  if (args.appDir) {
    const appDir = resolve(args.appDir);
    writeFileSync(join(dest, 'helenite.json'), `${JSON.stringify({ appDir }, null, 2)}\n`);
    mkdirSync(appDir, { recursive: true });
    cpSync(join(dest, 'app.md'), join(appDir, 'app.md'));
  }
}
else cpSync(join(here, 'templates', args.template), dest, { recursive: true });
for (const file of files(dest)) {
  const text = readFileSync(file, 'utf8');
  const filled = text.replace(/\{\{(id|name|nameJs|nameJson|nameYaml|nameCss|helenite)\}\}/g, (_, k) => vars[k] ?? fail(`template ${relative(dest, file)} uses {{${k}}}, which ${args.template} does not set`));
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
  'app-vite': [
    `  cd ${shown} && npm install && npm run build`,
    args.appDir
      ? `  The build writes app.md, view.js and view.css into ${resolve(args.appDir)}; approve its permissions and open it with "Apps: Open app…".`
      : `  Vite writes view.js and view.css beside app.md. Copy ${shown}/ (without node_modules) to <vault>/Apps/${name}/, approve its permissions,\n  and open it with "Apps: Open app…". (Keep node_modules out of the vault: it indexes every file; use --app-dir to build into it instead.)`,
    '  Edit src/, rebuild, and Helenite reloads the app when view.js changes.',
  ],
  'app-pages': [
    `  Copy ${shown}/ to <vault>/Apps/${name}/, approve its permissions,`,
    '  and open it with the command "Apps: Open app…". Add pages under pages/ and list them in view.js.',
  ],
}[args.template];
console.log(`Created ${args.template} "${name}" (${id}) in ${shown}\n\nNext:\n${next.join('\n')}\n\nGuide: docs/dev/getting-started.md`);
