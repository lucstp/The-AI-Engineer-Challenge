import path from "node:path";

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Default to node — server-side tests (routes, server actions, pure
    // libs) run in the fast Node env. Component tests opt into jsdom via
    // a `// @vitest-environment jsdom` pragma at file top.
    environment: "node",
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    // Runs before any test module is imported. Sets SESSION_SECRET so
    // `lib/env.ts` validation passes when test code transitively imports
    // server modules.
    setupFiles: ["./tests/vitest-setup.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
    },
  },
});
