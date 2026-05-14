import { defineConfig, devices } from "@playwright/test";

import { TEST_BASE_URL, TEST_PORT, TEST_SESSION_SECRET } from "./tests/global-setup";

/**
 * Dedicated config for the visual walkthrough spec. Keeps screenshot
 * capture out of `pnpm test:e2e` (which is meant to be fast and stable),
 * while letting us run it on demand:
 *
 *   pnpm exec playwright test --config=walkthrough.config.ts
 */
export default defineConfig({
  testDir: "./tests/walkthrough",
  timeout: 60_000,
  reporter: "line",
  globalSetup: "./tests/global-setup.ts",
  use: {
    baseURL: TEST_BASE_URL,
    viewport: { width: 1440, height: 900 },
    trace: "off",
  },
  webServer: {
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
