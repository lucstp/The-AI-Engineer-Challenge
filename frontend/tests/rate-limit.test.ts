import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { checkRateLimit, getClientKey } from "@/lib/rate-limit";

/**
 * Sliding-window per-key rate-limit contract.
 *
 * Tests target the in-memory fallback (the Upstash path is exercised by
 * `app/api/chat/route.ts` integration in chat-route.test.ts via real
 * decision contract; mocking @upstash/ratelimit here would test the mock,
 * not the limiter). The in-memory path covers:
 *   - Allow under cap (1..20 within window)
 *   - Reject at and beyond cap (21+)
 *   - retryAfterSec math: ceil((resetAt - now) / 1000)
 *   - Window expiry: bucket reset after WINDOW_MS
 *   - Per-key isolation: distinct keys do not share a bucket
 *
 * getClientKey extracts a stable identifier from headers:
 *   - First x-forwarded-for hop wins
 *   - Falls back to x-real-ip
 *   - Then to "unknown-client" so the limiter never partitions on undefined
 */

// Each test uses a UNIQUE key so the module-scope buckets Map does not
// leak state across tests. Bucket keys live in process memory for
// CLEANUP_INTERVAL_MS (5 minutes) — well beyond a test run — so isolation
// via key uniqueness is more robust than trying to reset the module.
function uniqueKey(label: string): string {
  return `vitest-${label}-${Math.random().toString(36).slice(2, 10)}`;
}

describe("checkRateLimit — in-memory sliding window", () => {
  it("allows the first request through with the correct remaining budget", async () => {
    const key = uniqueKey("first");
    const decision = await checkRateLimit(key);

    expect(decision.allowed).toBe(true);
    expect(decision.remaining).toBe(19); // MAX_REQUESTS_PER_WINDOW - 1
    expect(decision.retryAfterSec).toBe(0);
    expect(decision.resetAt).toBeGreaterThan(Date.now());
  });

  it("allows every request up to the 20-request cap within the window", async () => {
    const key = uniqueKey("under-cap");
    for (let i = 1; i <= 20; i++) {
      const decision = await checkRateLimit(key);
      expect(decision.allowed).toBe(true);
      expect(decision.remaining).toBe(20 - i);
    }
  });

  it("rejects the 21st request and returns a retry-after window", async () => {
    const key = uniqueKey("over-cap");
    for (let i = 0; i < 20; i++) {
      await checkRateLimit(key);
    }
    const blocked = await checkRateLimit(key);

    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
    expect(blocked.retryAfterSec).toBeLessThanOrEqual(60); // WINDOW_MS / 1000
  });

  it("keeps separate budgets per key", async () => {
    const a = uniqueKey("isolation-a");
    const b = uniqueKey("isolation-b");

    for (let i = 0; i < 20; i++) {
      await checkRateLimit(a);
    }
    const aBlocked = await checkRateLimit(a);
    const bFirst = await checkRateLimit(b);

    expect(aBlocked.allowed).toBe(false);
    expect(bFirst.allowed).toBe(true);
    expect(bFirst.remaining).toBe(19);
  });
});

describe("checkRateLimit — window expiry", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("resets the bucket once the window has elapsed", async () => {
    const key = uniqueKey("window-expiry");

    // Saturate the bucket within the window.
    for (let i = 0; i < 20; i++) {
      await checkRateLimit(key);
    }
    const blocked = await checkRateLimit(key);
    expect(blocked.allowed).toBe(false);

    // Advance time past the 60s window.
    vi.advanceTimersByTime(60_001);

    const afterWindow = await checkRateLimit(key);
    expect(afterWindow.allowed).toBe(true);
    expect(afterWindow.remaining).toBe(19);
  });
});

describe("getClientKey", () => {
  function requestWith(headers: Record<string, string>): Request {
    return new Request("http://localhost/api/chat", {
      method: "POST",
      headers,
    });
  }

  it("returns the first hop of x-forwarded-for when present", () => {
    const request = requestWith({ "x-forwarded-for": "203.0.113.10, 198.51.100.7" });
    expect(getClientKey(request)).toBe("203.0.113.10");
  });

  it("trims whitespace from the first forwarded hop", () => {
    const request = requestWith({ "x-forwarded-for": "  203.0.113.10  , 198.51.100.7" });
    expect(getClientKey(request)).toBe("203.0.113.10");
  });

  it("falls back to x-real-ip when x-forwarded-for is absent", () => {
    const request = requestWith({ "x-real-ip": "203.0.113.42" });
    expect(getClientKey(request)).toBe("203.0.113.42");
  });

  it("falls back to a generic bucket when no client-IP headers are present", () => {
    const request = requestWith({});
    // A generic bucket is the worst case — distinct unknown clients share
    // a limit. Documented behavior; tested so a refactor can't silently
    // partition on undefined or empty string.
    expect(getClientKey(request)).toBe("unknown-client");
  });

  it("falls back to x-real-ip when x-forwarded-for is present but empty/whitespace", () => {
    const request = requestWith({
      "x-forwarded-for": "   ",
      "x-real-ip": "203.0.113.99",
    });
    expect(getClientKey(request)).toBe("203.0.113.99");
  });
});
