import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// The UI test runs against a tiny recording fake of the `obsidian` classes the tab uses (no DOM needed).
export default defineConfig({
  resolve: { alias: { obsidian: fileURLToPath(new URL('./test/fake-obsidian.ts', import.meta.url)) } },
  test: { include: ['test/**/*.test.ts'], testTimeout: 20000 },
});
