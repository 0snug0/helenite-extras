import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const api = fileURLToPath(new URL('../../packages/obsidian-api/src/index.ts', import.meta.url));
const helenite = fileURLToPath(new URL('../../packages/obsidian-api/src/helenite-module.ts', import.meta.url));

export default defineConfig({
  resolve: { alias: { obsidian: api, helenite } },
  test: { environment: 'node', include: ['test/**/*.test.ts'] },
});
