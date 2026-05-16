/**
 * CSRF defense-in-depth helpers for route handlers.
 *
 * Server Actions get free CSRF protection from Next.js; route handlers do
 * not. Every state-changing route handler (`/api/chat`, `/api/verify-key`,
 * ...) calls `isSameOrigin(request)` before any work to reject obvious
 * cross-site abuse cheaply.
 *
 * The check is intentionally strict:
 *   • Missing Origin header → false (curl probes / server-to-server abuse
 *     fails closed). Legitimate browsers always include Origin on POST.
 *   • Malformed Origin URL → false.
 *   • Origin host ≠ request URL host → false.
 *
 * Defense in depth — `sameSite: "strict"` on the session cookie already
 * blocks cross-site cookie carry on conformant browsers. This guard
 * closes the gap on non-conformant ones and on direct curl-style abuse
 * that doesn't go through a browser at all.
 */

export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) {
    return false;
  }
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}
