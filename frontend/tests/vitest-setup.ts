/**
 * Vitest global setup. Sets a deterministic SESSION_SECRET before any
 * test file imports `@/lib/env` (which throws at module load if missing).
 * Mirrors `tests/global-setup.ts` for Playwright. Hardcoded test secret
 * — never reuse in any deployed environment.
 */
process.env.SESSION_SECRET = "vitest-only-DO-NOT-USE-IN-ANY-DEPLOYED-ENVIRONMENT-32+chars";
