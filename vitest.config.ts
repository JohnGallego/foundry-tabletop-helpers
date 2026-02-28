/**
 * Vitest configuration.
 *
 * Kept separate from vite.config.ts so the production build config remains
 * unaffected by test settings.
 *
 * Key decisions:
 *  - environment: "node"   — tests run in Node, no browser APIs assumed
 *  - No globals mode        — test helpers are explicitly imported from "vitest"
 *                             so we avoid polluting the global namespace and
 *                             don't need to extend tsconfig types for test globals
 *  - include pattern        — only files ending in .test.ts inside src/
 */

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});

