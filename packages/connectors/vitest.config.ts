import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const api = fileURLToPath(new URL('../obsidian-api/src/index.ts', import.meta.url));
const helenite = fileURLToPath(new URL('../obsidian-api/src/helenite-module.ts', import.meta.url));

// The Settings tabs (test/ui.test.ts, test/data-tab.test.ts) run against the real `obsidian` implementation (obsidian-api)
// in jsdom, as the core plugins do; they opt in with `@vitest-environment jsdom` and import ./ui-setup. The rest run in node.
export default defineConfig({
  resolve: { alias: { obsidian: api, helenite } },
  test: { include: ['test/**/*.test.ts'], testTimeout: 20000 },
});
