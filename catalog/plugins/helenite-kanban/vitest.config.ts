import { defineConfig } from 'vitest/config';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// The pure-logic tests need none of this; plugin.test.ts loads the built plugin into a real Helenite App under jsdom.
// The app (the repository that mounts extras/) holds the runtime these tests load. A standalone clone has no app: no tests run.
const appRoot = fileURLToPath(new URL('../../../../', import.meta.url));
const hasApp = existsSync(`${appRoot}packages/obsidian-api/src/index.ts`);
const api = `${appRoot}packages/obsidian-api/src/index.ts`;
const helenite = `${appRoot}packages/obsidian-api/src/helenite-module.ts`;

export default defineConfig({
  resolve: { alias: { obsidian: api, helenite } },
  server: hasApp ? { fs: { allow: [appRoot] } } : {},
  test: { environment: 'jsdom', include: hasApp ? ['test/**/*.test.ts'] : [], passWithNoTests: true, setupFiles: hasApp ? [`${appRoot}plugins/core-build/test/setup.ts`] : [], testTimeout: 20000 },
});
