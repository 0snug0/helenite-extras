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
  for (const s of ['helenite-plugins', 'helenite-apps', 'helenite-layout', 'helenite-notes']) {
    const md = readFileSync(join(root, 'skills', s, 'SKILL.md'), 'utf8');
    assert.match(md, new RegExp(`^---\\nname: ${s}\\ndescription: .+\\n---`));
  }
  assert.ok(existsSync(join(root, 'prompts/addendum.md')));
  // Default load must not double-register hooks or the MCP server.
  assert.ok(!existsSync(join(root, 'hooks/hooks.json')) && !existsSync(join(root, '.mcp.json')));
  assert.ok(readdirSync(join(root, 'skills')).length === 4);
});
