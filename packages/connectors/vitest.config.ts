import { defineConfig } from 'vitest/config';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// The Settings tabs run against the app's `obsidian` implementation (packages/obsidian-api), so they run from the app that mounts
// extras/. A standalone clone has no app: no tests run.
const appRoot = fileURLToPath(new URL('../../../', import.meta.url));
const hasApp = existsSync(`${appRoot}packages/obsidian-api/src/index.ts`);
const api = `${appRoot}packages/obsidian-api/src/index.ts`;
const helenite = `${appRoot}packages/obsidian-api/src/helenite-module.ts`;

// The Settings tabs (test/ui.test.ts, test/data-tab.test.ts) run against the real `obsidian` implementation (obsidian-api)
// in jsdom, as the core plugins do; they opt in with `@vitest-environment jsdom` and import ./ui-setup. The rest run in node.
export default defineConfig({
  resolve: { alias: { obsidian: api, helenite } },
  server: hasApp ? { fs: { allow: [appRoot] } } : {},
  test: { include: hasApp ? ['test/**/*.test.ts'] : [], passWithNoTests: true, testTimeout: 20000 },
});
