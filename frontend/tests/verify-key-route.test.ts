import { beforeEach, describe, expect, it, vi } from "vitest";

const { cookiesMock, checkRateLimitMock } = vi.hoisted(() => ({
  cookiesMock: vi.fn(),
  checkRateLimitMock: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: cookiesMock,
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: checkRateLimitMock,
  getClientKey: () => "test-client",
}));

import { POST } from "@/app/api/verify-key/route";

const VALID_KEY = "sk-valid-test-1234567890123456789012";

function createCookieStore() {
  return {
    get: vi.fn(() => undefined),
    set: vi.fn(),
    delete: vi.fn(),
  };
}

function makeJsonRequest(body: unknown, origin = "http://localhost"): Request {
  return new Request("http://localhost/api/verify-key", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: origin,
    },
    body: JSON.stringify(body),
  });
}

describe("app/api/verify-key/route", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    cookiesMock.mockReset();
    cookiesMock.mockResolvedValue(createCookieStore());
    checkRateLimitMock.mockReset();
    checkRateLimitMock.mockResolvedValue({
      allowed: true,
      remaining: 19,
      resetAt: Date.now() + 60_000,
      retryAfterSec: 0,
    });
    vi.stubGlobal("fetch", vi.fn());
    vi.spyOn(crypto, "randomUUID").mockReturnValue("req-fixed-123");
  });

  it("rejects requests with no Origin header (server-to-server probes)", async () => {
    const originlessRequest = new Request("http://localhost/api/verify-key", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: VALID_KEY }),
    });

    const response = await POST(originlessRequest);
    const payload = (await response.json()) as { detail: string };

    expect(response.status).toBe(403);
    expect(payload.detail).toContain("Cross-origin");
    expect(response.headers.get("x-request-id")).toBe("req-fixed-123");
  });

  it("rejects cross-origin POSTs with 403 (CSRF defense-in-depth)", async () => {
    const response = await POST(makeJsonRequest({ key: VALID_KEY }, "https://evil.example.com"));
    expect(response.status).toBe(403);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns 429 when rate limit exceeded", async () => {
    checkRateLimitMock.mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      resetAt: Date.now() + 30_000,
      retryAfterSec: 30,
    });

    const response = await POST(makeJsonRequest({ key: VALID_KEY }));
    const payload = (await response.json()) as { detail: string };

    expect(response.status).toBe(429);
    expect(payload.detail).toContain("Too many requests");
    expect(response.headers.get("Retry-After")).toBe("30");
    expect(response.headers.get("X-RateLimit-Remaining")).toBe("0");
    expect(fetch).not.toHaveBeenCalled();
  });

  // NOTE: the 413 Content-Length guard at MAX_REQUEST_BODY_BYTES is not
  // unit-tested here because `Content-Length` is a "forbidden request
  // header" per the Fetch spec — undici silently strips manual sets on
  // the Request constructor, and small string bodies don't always
  // auto-populate Content-Length in the Node test env. In production
  // the runtime (browser/Vercel) sets Content-Length from the actual
  // payload, so the guard fires correctly. Visual prod-mode smoke +
  // upstream pen-tests cover this path. Same pattern as chat-route.

  it("returns 400 on invalid JSON body", async () => {
    const invalidJsonRequest = new Request("http://localhost/api/verify-key", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "http://localhost",
      },
      body: "{not-json",
    });

    const response = await POST(invalidJsonRequest);
    const payload = (await response.json()) as { detail: string };

    expect(response.status).toBe(400);
    expect(payload.detail).toContain("Invalid JSON");
  });

  it("returns 400 when the `key` field is missing", async () => {
    const response = await POST(makeJsonRequest({ notKey: "something" }));

    expect(response.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns 400 when the key is shorter than 24 characters", async () => {
    const response = await POST(makeJsonRequest({ key: "sk-short" }));

    expect(response.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns 400 when the key does not start with 'sk-'", async () => {
    const response = await POST(makeJsonRequest({ key: "not-an-openai-key-1234567890" }));
    const payload = (await response.json()) as { detail: string };

    expect(response.status).toBe(400);
    expect(payload.detail).toContain("sk-");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("stores key sealed in a secure cookie on OpenAI 200 (happy path)", async () => {
    const cookieStore = createCookieStore();
    cookiesMock.mockResolvedValue(cookieStore);
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 200 }));

    const response = await POST(makeJsonRequest({ key: VALID_KEY }));
    const payload = (await response.json()) as { ok: boolean; message: string };

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.message).toContain("verified");
    expect(cookieStore.set).toHaveBeenCalledWith(
      "openai_api_key",
      expect.any(String),
      expect.objectContaining({
        httpOnly: true,
        sameSite: "lax",
        path: "/",
      })
    );
    // Stored value must be the sealed form, never the raw key.
    const storedValue = cookieStore.set.mock.calls[0]?.[1] as string;
    expect(storedValue).not.toBe(VALID_KEY);
    expect(storedValue.split(".").length).toBe(3);
  });

  it("returns ok=false when OpenAI rejects the key (401)", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 401 }));

    const response = await POST(makeJsonRequest({ key: VALID_KEY }));
    const payload = (await response.json()) as { ok: boolean; message: string };

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(false);
    expect(payload.message).toContain("invalid, revoked, or expired");
  });

  it("returns ok=true with warning when OpenAI rate-limits (429)", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 429 }));

    const response = await POST(makeJsonRequest({ key: VALID_KEY }));
    const payload = (await response.json()) as { ok: boolean; message: string };

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.message).toContain("rate-limited");
  });

  it("returns ok=false with network guidance when OpenAI is unreachable", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("socket hang up"));

    const response = await POST(makeJsonRequest({ key: VALID_KEY }));
    const payload = (await response.json()) as { ok: boolean; message: string };

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(false);
    expect(payload.message).toContain("Could not reach OpenAI");
  });
});
