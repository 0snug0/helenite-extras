import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const api = fileURLToPath(new URL('../../packages/obsidian-api/src/index.ts', import.meta.url));

export default defineConfig({
  resolve: { alias: { obsidian: api } },
  test: { environment: 'node', include: ['test/**/*.test.ts'] },
});
