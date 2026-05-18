import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Boot-time environment validation contract for `lib/env.ts`.
 *
 * The module validates process.env at first import. Each test reimports
 * the module under a stubbed env so the gate's behavior can be verified
 * deterministically across NODE_ENV / SESSION_SECRET combinations.
 *
 * Tests cover:
 *   - SESSION_SECRET length floor (≥32 non-prod, ≥48 prod)
 *   - SESSION_SECRET Shannon-entropy floor in production (≥3 bits/char)
 *   - OPENAI_MODEL default ("gpt-4.1-mini") + override
 *   - OPENAI_MAX_COMPLETION_TOKENS default (4000) + positive-int validation
 *
 * The vitest-setup pins a deterministic SESSION_SECRET so every other
 * test file gets a passing import. These tests deliberately stub
 * different values per case, then unstub + reset modules for isolation.
 */

const VITEST_DEFAULT_SECRET = "vitest-only-DO-NOT-USE-IN-ANY-DEPLOYED-ENVIRONMENT-32+chars";

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("env — non-production gate (NODE_ENV=test)", () => {
  it("accepts a 32+ char SESSION_SECRET", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("SESSION_SECRET", VITEST_DEFAULT_SECRET);

    await expect(import("@/lib/env")).resolves.toBeDefined();
  });

  it("rejects a SESSION_SECRET below 32 chars", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("SESSION_SECRET", "too-short-secret");

    await expect(import("@/lib/env")).rejects.toThrow(
      /SESSION_SECRET must be at least 32 characters/
    );
  });

  it("does NOT enforce entropy in non-production (loose dev gate)", async () => {
    vi.stubEnv("NODE_ENV", "test");
    // 40 a's — 0 bits/char Shannon entropy — would fail the production
    // gate but passes the dev/test gate (length only).
    vi.stubEnv("SESSION_SECRET", "a".repeat(40));

    await expect(import("@/lib/env")).resolves.toBeDefined();
  });
});

describe("env — production gate (NODE_ENV=production)", () => {
  it("rejects a SESSION_SECRET below 48 chars", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SESSION_SECRET", "x".repeat(40)); // length too short

    await expect(import("@/lib/env")).rejects.toThrow(
      /SESSION_SECRET must be at least 48 characters/
    );
  });

  it("rejects a long but low-entropy SESSION_SECRET (50 'a's — 0 bits/char)", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SESSION_SECRET", "a".repeat(50));

    await expect(import("@/lib/env")).rejects.toThrow(/entropy is .* production requires .*>= 3/);
  });

  it("rejects a long low-entropy SESSION_SECRET (repeating 2-char pattern, 1 bit/char)", async () => {
    vi.stubEnv("NODE_ENV", "production");
    // "ababab..." over 60 chars → 1.0 bits/char entropy → below 3 floor.
    vi.stubEnv("SESSION_SECRET", "ab".repeat(30));

    await expect(import("@/lib/env")).rejects.toThrow(/entropy is .* production requires .*>= 3/);
  });

  it("accepts a 48+ char SESSION_SECRET with sufficient entropy (≥3 bits/char)", async () => {
    vi.stubEnv("NODE_ENV", "production");
    // 60-char mixed-case + digits + symbols string with ~4+ bits/char.
    vi.stubEnv("SESSION_SECRET", "x9Q!aB7#cD2$eF6%gH4&iJ8*kL1@mN5^oP3+qR0?sT8/uV2wY7?z");

    await expect(import("@/lib/env")).resolves.toBeDefined();
  });
});

describe("env — OPENAI_MODEL default", () => {
  it("defaults to 'gpt-4.1-mini' when OPENAI_MODEL is unset", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("SESSION_SECRET", VITEST_DEFAULT_SECRET);
    // Pass `undefined` (not "") so zod's `.default()` fires — empty
    // string would fail `.min(1)` instead of falling through to default.
    vi.stubEnv("OPENAI_MODEL", undefined);

    const { serverEnv } = await import("@/lib/env");
    expect(serverEnv.OPENAI_MODEL).toBe("gpt-4.1-mini");
  });

  it("honors a non-default OPENAI_MODEL override (env trumps default)", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("SESSION_SECRET", VITEST_DEFAULT_SECRET);
    vi.stubEnv("OPENAI_MODEL", "gpt-5");

    const { serverEnv } = await import("@/lib/env");
    expect(serverEnv.OPENAI_MODEL).toBe("gpt-5");
  });
});

describe("env — OPENAI_MAX_COMPLETION_TOKENS coercion", () => {
  it("defaults to 4000 when unset (reasoning-headroom floor across the dropdown)", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("SESSION_SECRET", VITEST_DEFAULT_SECRET);
    // Pass `undefined` so zod's `.default(4000)` fires — empty string
    // would coerce to 0 and fail `.positive()` instead.
    vi.stubEnv("OPENAI_MAX_COMPLETION_TOKENS", undefined);

    const { serverEnv } = await import("@/lib/env");
    expect(serverEnv.OPENAI_MAX_COMPLETION_TOKENS).toBe(4000);
  });

  it("coerces a numeric-string env var to a number", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("SESSION_SECRET", VITEST_DEFAULT_SECRET);
    vi.stubEnv("OPENAI_MAX_COMPLETION_TOKENS", "2500");

    const { serverEnv } = await import("@/lib/env");
    expect(serverEnv.OPENAI_MAX_COMPLETION_TOKENS).toBe(2500);
  });

  it("rejects a zero or negative OPENAI_MAX_COMPLETION_TOKENS", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("SESSION_SECRET", VITEST_DEFAULT_SECRET);
    vi.stubEnv("OPENAI_MAX_COMPLETION_TOKENS", "-1");

    await expect(import("@/lib/env")).rejects.toThrow(/OPENAI_MAX_COMPLETION_TOKENS/);
  });
});
