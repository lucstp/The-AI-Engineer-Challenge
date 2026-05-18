import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/csp-report/route";

/**
 * /api/csp-report route handler contract.
 *
 * - Always returns 204 No Content (reports are best-effort; the browser
 *   must not be blocked by a slow sink)
 * - Caps the report body to 8KB (CSP reports are tiny; anything larger
 *   is junk and is early-returned without parsing)
 * - Logs a structured one-liner with type / ts / ua / report
 * - Never leaks raw error bodies; malformed reports are swallowed
 *   (`return 204`, never 500)
 */

function makeRequest(opts: { body: string; contentLength?: number; userAgent?: string }): Request {
  const headers: HeadersInit = {
    "Content-Type": "application/csp-report",
  };
  if (opts.contentLength !== undefined) {
    headers["content-length"] = String(opts.contentLength);
  }
  if (opts.userAgent !== undefined) {
    headers["user-agent"] = opts.userAgent;
  }
  return new Request("http://localhost/api/csp-report", {
    method: "POST",
    headers,
    body: opts.body,
  });
}

let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  warnSpy.mockRestore();
});

describe("/api/csp-report", () => {
  it("returns 204 for a valid CSP violation report", async () => {
    const body = '{"csp-report":{"violated-directive":"script-src","blocked-uri":"https://x"}}';
    const response = await POST(makeRequest({ body }));
    expect(response.status).toBe(204);
  });

  it("returns 204 early without invoking console.warn when content-length exceeds 8KB", async () => {
    const huge = "x".repeat(9000);
    const response = await POST(makeRequest({ body: huge, contentLength: 9000 }));

    expect(response.status).toBe(204);
    // Early-return guard skipped the body read + log entirely.
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("returns 204 even when the body is malformed (best-effort, never 500)", async () => {
    const response = await POST(makeRequest({ body: "not-valid-json{{{" }));
    expect(response.status).toBe(204);
  });

  it("logs a structured payload with type / ts / ua / report fields", async () => {
    const body = '{"csp-report":{"violated-directive":"script-src","blocked-uri":"https://x"}}';
    await POST(makeRequest({ body, userAgent: "Mozilla/5.0 (TestBot)" }));

    expect(warnSpy).toHaveBeenCalledTimes(1);
    const loggedRaw = warnSpy.mock.calls[0]?.[0];
    expect(typeof loggedRaw).toBe("string");
    const logged = JSON.parse(loggedRaw as string) as {
      type: string;
      ts: string;
      ua: string | null;
      report: string;
    };
    expect(logged.type).toBe("csp-violation");
    expect(typeof logged.ts).toBe("string");
    expect(new Date(logged.ts).toString()).not.toBe("Invalid Date");
    expect(logged.ua).toBe("Mozilla/5.0 (TestBot)");
    expect(logged.report).toContain("script-src");
  });

  it("logs ua=null when the request has no User-Agent header", async () => {
    const body = '{"csp-report":{"violated-directive":"img-src"}}';
    await POST(makeRequest({ body }));

    const loggedRaw = warnSpy.mock.calls[0]?.[0];
    const logged = JSON.parse(loggedRaw as string) as { ua: string | null };
    expect(logged.ua).toBeNull();
  });

  it("truncates the logged report to MAX_REPORT_BYTES (8KB) when no content-length header is set", async () => {
    // 10KB body with no content-length header passes the early-return
    // check, so the route reads the body and slices to MAX_REPORT_BYTES.
    const oversized = "x".repeat(10_000);
    await POST(makeRequest({ body: oversized }));

    expect(warnSpy).toHaveBeenCalledTimes(1);
    const loggedRaw = warnSpy.mock.calls[0]?.[0];
    const logged = JSON.parse(loggedRaw as string) as { report: string };
    expect(logged.report).toHaveLength(8 * 1024);
  });
});
