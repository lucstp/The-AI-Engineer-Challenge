/**
 * Playwright global setup. Runs once before any test, in the same Node
 * process as the test runner.
 *
 * Purpose: guarantee a deterministic SESSION_SECRET shared between
 *  (a) the dev server Playwright will spawn (via webServer.env), and
 *  (b) the test runner itself (so test code that calls `seal()` from
 *      `@/lib/session-crypto` derives the same AES key as the server).
 *
 * Port 3010 is dedicated to tests so the developer's own `pnpm dev` on
 * 3000 is never interfered with. Both the dev server and the test
 * server can run side-by-side.
 *
 * The session secret is for tests only. Never reuse it in any deployed
 * environment — it is intentionally hardcoded and visible.
 */
export const TEST_SESSION_SECRET =
  "playwright-test-only-DO-NOT-USE-IN-ANY-DEPLOYED-ENVIRONMENT-32+chars";

export const TEST_PORT = 3010;
export const TEST_BASE_URL = `http://localhost:${TEST_PORT}`;

export default async function globalSetup(): Promise<void> {
  process.env.SESSION_SECRET = TEST_SESSION_SECRET;
}
