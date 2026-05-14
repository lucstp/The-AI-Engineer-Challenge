import { defineConfig, devices } from "@playwright/test";

import { TEST_BASE_URL, TEST_PORT, TEST_SESSION_SECRET } from "./tests/global-setup";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  fullyParallel: true,
  reporter: "line",
  globalSetup: "./tests/global-setup.ts",
  use: {
    baseURL: TEST_BASE_URL,
    trace: "on-first-retry",
  },
  webServer: {
    // Tests run against the production build, matching Vercel exactly
    // and avoiding the `next dev` singleton lock (so a developer can
    // keep `pnpm dev` running on 3000 while tests use 3010). The
    // `.next-test` dist dir keeps test artifacts isolated from dev.
    command: `pnpm exec next build && pnpm exec next start --hostname localhost --port ${TEST_PORT}`,
    cwd: ".",
    port: TEST_PORT,
    reuseExistingServer: true,
    timeout: 120_000,
    env: {
      SESSION_SECRET: TEST_SESSION_SECRET,
      NEXT_DIST_DIR: ".next-test",
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
