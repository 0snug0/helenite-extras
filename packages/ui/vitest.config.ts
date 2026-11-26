import { defineConfig } from "vitest/config";
export default defineConfig({ test: { globalSetup: ["../../scripts/vitest-cleanup.mjs"], environment: "happy-dom", include: ["test/**/*.test.ts"] } });
