import { defineConfig } from 'vitest/config';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// The app (the repository that mounts extras/) holds the runtime these tests load. A standalone clone has no app: no tests run.
const appRoot = fileURLToPath(new URL('../../../../', import.meta.url));
const hasApp = existsSync(`${appRoot}packages/obsidian-api/src/index.ts`);
const api = `${appRoot}packages/obsidian-api/src/index.ts`;
const helenite = `${appRoot}packages/obsidian-api/src/helenite-module.ts`;

export default defineConfig({
  resolve: { alias: { obsidian: api, helenite } },
  server: hasApp ? { fs: { allow: [appRoot] } } : {},
  test: { environment: 'node', include: hasApp ? ['test/**/*.test.ts'] : [], passWithNoTests: true },
});
