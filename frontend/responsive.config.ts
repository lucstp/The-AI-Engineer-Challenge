import { defineConfig, devices } from "@playwright/test";

import { TEST_BASE_URL, TEST_PORT, TEST_SESSION_SECRET } from "./tests/global-setup";

/**
 * Dedicated config for the responsive visual audit. NOT part of
 * `pnpm test:e2e`. Run on demand:
 *
 *   pnpm exec playwright test --config=responsive.config.ts
 *
 * Each project pins a representative breakpoint; the shared spec captures
 * locked + verified screenshots at every project so the same UX surface
 * can be visually diffed across iPhone SE → desktop.
 */
export default defineConfig({
  testDir: "./tests/responsive",
  timeout: 60_000,
  reporter: "line",
  fullyParallel: true,
  globalSetup: "./tests/global-setup.ts",
  use: {
    baseURL: TEST_BASE_URL,
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
      name: "mobile-375",
      use: { ...devices["iPhone SE"], viewport: { width: 375, height: 667 } },
    },
    {
      name: "mobile-414",
      use: { ...devices["iPhone 12 Pro Max"], viewport: { width: 414, height: 896 } },
    },
    {
      name: "tablet-768",
      use: { ...devices["iPad (gen 7)"], viewport: { width: 768, height: 1024 } },
    },
    {
      name: "laptop-1024",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1024, height: 768 } },
    },
    {
      name: "desktop-1440",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
  ],
});
