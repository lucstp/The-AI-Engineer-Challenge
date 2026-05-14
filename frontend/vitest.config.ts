import path from "node:path";

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
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
