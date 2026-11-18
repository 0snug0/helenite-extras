import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// The pure-logic tests need none of this; plugin.test.ts loads the built plugin into a real Helenite App under jsdom.
const api = fileURLToPath(new URL('../../packages/obsidian-api/src/index.ts', import.meta.url));
const helenite = fileURLToPath(new URL('../../packages/obsidian-api/src/helenite-module.ts', import.meta.url));

export default defineConfig({
  resolve: { alias: { obsidian: api, helenite } },
  test: { environment: 'jsdom', include: ['test/**/*.test.ts'], setupFiles: ['../core-build/test/setup.ts'], testTimeout: 20000 },
});
