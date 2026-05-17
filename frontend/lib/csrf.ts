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
 * Defense in depth — `sameSite: "lax"` on the session cookie already
 * blocks the only CSRF vector that matters here (cross-site state-
 * changing POST: cookie withheld on cross-site POST in `lax` mode just
 * as in `strict`). This guard closes the gap on non-conformant
 * browsers and on direct curl-style abuse that doesn't go through a
 * browser at all. `lax` is chosen over `strict` because iOS WebKit
 * over-applies `strict` to legitimate same-origin refreshes — see the
 * comment on the cookie set in `lib/data/auth.ts` for the full
 * rationale.
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
