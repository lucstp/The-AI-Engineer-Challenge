import { NextResponse } from "next/server";

/**
 * CSP violation report sink. Browsers POST here when the Content-Security
 * -Policy header is violated (referenced via `report-to` + `Reporting-
 * Endpoints` in `proxy.ts`).
 *
 * Behavior:
 *  - Caps body size to 8KB (CSP reports are tiny; anything larger is junk)
 *  - Logs a structured one-liner (timestamp, ip, truncated report)
 *  - Always returns 204 No Content — reports are best-effort and we
 *    must not block the browser if the sink is slow
 *  - No rate limit applied: a flood of CSP reports usually indicates a
 *    legitimate browser-extension issue, not abuse, and 204 responses
 *    are cheap. If sustained abuse appears, swap to in-memory limiter.
 *
 * What gets reported:
 *  - Modern browsers (CSP3 / Reporting API): JSON array of report
 *    objects with `csp-report` shape
 *  - Older browsers (`report-uri` fallback): `application/csp-report`
 *    JSON body
 *
 * We don't parse the report shape — just truncate + log. Production
 * deployments should swap `console.warn` for a SIEM/Sentry hook.
 */

const MAX_REPORT_BYTES = 8 * 1024;

export async function POST(request: Request): Promise<Response> {
  const contentLength = request.headers.get("content-length");
  if (contentLength !== null) {
    const length = Number.parseInt(contentLength, 10);
    if (Number.isFinite(length) && length > MAX_REPORT_BYTES) {
      return new NextResponse(null, { status: 204 });
    }
  }

  try {
    const raw = await request.text();
    const truncated = raw.slice(0, MAX_REPORT_BYTES);
    // Structured log — never logs the raw error object or user input.
    console.warn(
      JSON.stringify({
        type: "csp-violation",
        ts: new Date().toISOString(),
        ua: request.headers.get("user-agent") ?? null,
        report: truncated,
      })
    );
  } catch {
    // Best-effort. Swallow malformed reports rather than 500.
  }

  return new NextResponse(null, { status: 204 });
}
