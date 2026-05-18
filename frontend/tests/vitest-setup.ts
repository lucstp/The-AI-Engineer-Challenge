/**
 * Vitest global setup.
 *
 * 1. Sets a deterministic SESSION_SECRET before any test file imports
 *    `@/lib/env` (which throws at module load if missing). Mirrors
 *    `tests/global-setup.ts` for Playwright. Hardcoded test secret —
 *    never reuse in any deployed environment.
 *
 * 2. Registers @testing-library/react cleanup explicitly. RTL's auto-
 *    cleanup looks for a global `afterEach`, which vitest does not expose
 *    when `globals: false` (our config). Without explicit registration,
 *    DOM nodes leak between component tests in the same file and queries
 *    like `screen.getByRole(...)` fail with "Found multiple elements".
 *    `cleanup()` is a no-op when no React tree was rendered, so it's
 *    safe to run after every test — including node-env unit tests.
 */
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

process.env.SESSION_SECRET = "vitest-only-DO-NOT-USE-IN-ANY-DEPLOYED-ENVIRONMENT-32+chars";

afterEach(() => {
  cleanup();
});
