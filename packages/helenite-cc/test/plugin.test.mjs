import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('manifest, variants and skills are well formed', () => {
  assert.equal(JSON.parse(readFileSync(join(root, '.claude-plugin/plugin.json'), 'utf8')).name, 'helenite-cc');
  const hooks = JSON.parse(readFileSync(join(root, 'variants/hooks.plugin.json'), 'utf8')).hooks;
  assert.ok(hooks.Stop && hooks.PreToolUse);
  assert.match(readFileSync(join(root, 'variants/mcp.plugin.json'), 'utf8'), /\$\{HELENITE_MCP_URL\}/);
  for (const s of ['helenite-plugins', 'helenite-plugin-creator', 'helenite-apps', 'helenite-app-frameworks', 'helenite-layout', 'helenite-notes']) {
    const md = readFileSync(join(root, 'skills', s, 'SKILL.md'), 'utf8');
    assert.match(md, new RegExp(`^---\\nname: ${s}\\ndescription: .+\\n---`));
  }
  assert.ok(existsSync(join(root, 'prompts/addendum.md')));
  // Default load must not double-register hooks or the MCP server.
  assert.ok(!existsSync(join(root, 'hooks/hooks.json')) && !existsSync(join(root, '.mcp.json')));
  assert.ok(readdirSync(join(root, 'skills')).length === 7);
});

test('content skill and addendum cover the ask and render-check tools', () => {
  const md = readFileSync(join(root, 'skills/helenite-content/SKILL.md'), 'utf8');
  assert.match(md, /^---\nname: helenite-content\ndescription: .*Dataview.*\n---/);
  const addendum = readFileSync(join(root, 'prompts/addendum.md'), 'utf8');
  assert.match(addendum, /mcp__helenite__ask/);
  assert.match(addendum, /vault_capabilities/);
  assert.match(addendum, /note_render_check/);
  assert.match(addendum, /never list options in prose/i);
  assert.match(addendum, /Do not end a turn on an unanswered question/);
});

test('skill descriptions are valid YAML plain scalars', () => {
  for (const s of readdirSync(join(root, 'skills'))) {
    const fm = readFileSync(join(root, 'skills', s, 'SKILL.md'), 'utf8').split('\n---')[0];
    const desc = fm.split('\n').find((l) => l.startsWith('description: ')).slice('description: '.length);
    if (!/^["']/.test(desc)) assert.ok(!desc.includes(': ') && !desc.includes(' #'), `${s}: unquoted description has ': ' or ' #'`);
  }
});

test('plugin creator skill drives the wizard and the design system', () => {
  const dir = join(root, 'skills/helenite-plugin-creator');
  const md = readFileSync(join(dir, 'SKILL.md'), 'utf8');
  assert.match(md, /mcp__helenite__wizard/);
  assert.match(md, /Just me/);
  assert.match(md, /Shareable/);
  for (const ref of md.matchAll(/\]\(([\w-]+\.md)\)/g)) assert.ok(existsSync(join(dir, ref[1])), `missing ${ref[1]}`);
});

test('apps skill covers multi-page apps, read-only deep links and the app-pages template', () => {
  const md = readFileSync(join(root, 'skills/helenite-apps/SKILL.md'), 'utf8');
  assert.match(md, /## Multi-page apps/);
  assert.match(md, /--template app-pages/);
  assert.match(md, /Deep links are read-only/);
  assert.match(md, /never mark a secret `required: true`/i);
  assert.match(md, /migrate-to-media\.mjs/);
});


test('addendum and helenite-notes steer design review through ask review', () => {
  const addendum = readFileSync(join(root, 'prompts/addendum.md'), 'utf8');
  assert.match(addendum, /mcp__helenite__ask/);
  assert.match(addendum, /`review`/);
  const notes = readFileSync(join(root, 'skills/helenite-notes/SKILL.md'), 'utf8');
  for (const w of ['review', 'sections', 'concept', 'recommended']) assert.ok(notes.includes(w), w);
});
