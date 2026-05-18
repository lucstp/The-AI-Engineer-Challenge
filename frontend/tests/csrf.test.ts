import { describe, expect, it } from "vitest";

import { isSameOrigin } from "@/lib/csrf";

/**
 * CSRF defense-in-depth contract for state-changing route handlers.
 *
 * The guard runs BEFORE rate-limit / body parsing / auth on every
 * state-changing route (chat, verify-key). It is intentionally strict:
 * missing Origin → false, malformed Origin → false, host mismatch → false.
 * Only same-host (host:port, ignoring protocol — documented choice) passes.
 */

function makeRequest(opts: { url: string; origin?: string | null }): Request {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (opts.origin !== undefined && opts.origin !== null) {
    headers.set("origin", opts.origin);
  }
  return new Request(opts.url, { method: "POST", headers });
}

describe("isSameOrigin", () => {
  it("accepts requests whose Origin matches the request URL host", () => {
    const request = makeRequest({
      url: "https://example.com/api/chat",
      origin: "https://example.com",
    });
    expect(isSameOrigin(request)).toBe(true);
  });

  it("accepts a same-origin request with a path on the Origin header", () => {
    // Some clients send the full URL; URL parsing extracts host only.
    const request = makeRequest({
      url: "https://example.com/api/chat",
      origin: "https://example.com/some/path",
    });
    expect(isSameOrigin(request)).toBe(true);
  });

  it("rejects cross-origin POSTs (different host)", () => {
    const request = makeRequest({
      url: "https://example.com/api/chat",
      origin: "https://evil.example.net",
    });
    expect(isSameOrigin(request)).toBe(false);
  });

  it("rejects when the Origin header is missing (curl probes, server-to-server abuse)", () => {
    const request = makeRequest({ url: "https://example.com/api/chat" });
    expect(isSameOrigin(request)).toBe(false);
  });

  it("rejects an empty Origin header", () => {
    const request = makeRequest({
      url: "https://example.com/api/chat",
      origin: "",
    });
    expect(isSameOrigin(request)).toBe(false);
  });

  it("rejects a malformed Origin URL", () => {
    const request = makeRequest({
      url: "https://example.com/api/chat",
      origin: "not-a-url",
    });
    expect(isSameOrigin(request)).toBe(false);
  });

  it("rejects when ports differ on the same hostname (host = hostname:port)", () => {
    // host comparison includes port — distinct ports = distinct origins.
    const request = makeRequest({
      url: "http://localhost:3000/api/chat",
      origin: "http://localhost:3001",
    });
    expect(isSameOrigin(request)).toBe(false);
  });

  it("accepts http+localhost dev origin matching the request URL", () => {
    const request = makeRequest({
      url: "http://localhost:3000/api/chat",
      origin: "http://localhost:3000",
    });
    expect(isSameOrigin(request)).toBe(true);
  });

  it("treats different protocols on the same host as same-origin (documented host-only check)", () => {
    // This is intentional per the lib/csrf.ts header comment — the guard
    // is defense-in-depth on top of sameSite=lax cookie + Vercel-enforced
    // HTTPS in production. Protocol mismatch within the same host is not
    // a realistic browser-driven CSRF vector in this deployment.
    const request = makeRequest({
      url: "https://example.com/api/chat",
      origin: "http://example.com",
    });
    expect(isSameOrigin(request)).toBe(true);
  });
});
