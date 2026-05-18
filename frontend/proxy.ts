import { type NextRequest, NextResponse } from "next/server";

/**
 * Edge proxy (Next.js 16+ file convention — replaces the deprecated
 * `middleware.ts`). Emits a per-request CSP nonce and the strict CSP
 * header. Next.js auto-applies the nonce to its own hydration scripts
 * when a CSP with `nonce-*` is present.
 *
 * Why proxy (not next.config.ts) for CSP: nonces MUST be unique
 * per response. `next.config.ts` `headers()` are static.
 *
 * Other security headers (HSTS, X-Frame-Options, etc.) live in
 * `next.config.ts` since they don't change per request.
 */

export function proxy(request: NextRequest): NextResponse {
  // 16 random bytes → 22-char base64 nonce. Per-request, never reused.
  const nonce = Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString("base64");

  // CSP violation reports go back to the same origin. Built per-request
  // so the report endpoint always matches the deployment domain (works
  // for prod, preview, local-dev without env-var coupling).
  const requestUrl = new URL(request.url);
  const reportingEndpoint = `${requestUrl.protocol}//${requestUrl.host}/api/csp-report`;

  // strict-dynamic: trust scripts loaded by a nonced script, not by URL.
  //   `'unsafe-inline'`, `https:`, and `'self'` are IGNORED by CSP3
  //   browsers when `'strict-dynamic'` is present. They exist as
  //   fallbacks so CSP1/CSP2 browsers (which don't understand
  //   `'strict-dynamic'`) still get a functioning policy. Modern
  //   security posture is unchanged.
  // 'unsafe-eval' is needed only for Next.js dev hot-reload; gated to dev.
  const scriptSrc =
    process.env.NODE_ENV === "production"
      ? `'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-inline' https:`
      : `'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-inline' 'unsafe-eval' https:`;

  // style-src 'unsafe-inline': Tailwind v4 emits style attributes on
  // hydrated nodes; nonce-based style-src is not yet supported by
  // Tailwind's runtime. This is the documented Next.js + Tailwind v4
  // CSP recipe. img-src https: covers the Coldplay CDN backgrounds.
  //
  // Reporting: `report-to` is the CSP3 way (modern browsers, paired
  // with the `Reporting-Endpoints` response header below).
  // `report-uri` is the deprecated fallback for browsers that don't
  // support the Reporting API yet (Safari < 16, Firefox).
  const cspParts = [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' https: data: blob:",
    "font-src 'self' data:",
    // `https://*.sentry.io` allows the browser SDK to POST captured
    // errors to Sentry's regional ingest endpoint (e.g.
    // `o4511…ingest.us.sentry.io`). Without this, every client-side
    // error would itself trigger a CSP violation — silencing the very
    // signal we're trying to capture.
    "connect-src 'self' https://*.sentry.io",
    "media-src 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "upgrade-insecure-requests",
    "report-to csp-endpoint",
    `report-uri ${reportingEndpoint}`,
  ];
  const cspHeader = cspParts.join("; ");

  // Pass nonce to the React tree via request header so server
  // components can read it via `headers()` from `next/headers`.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("content-security-policy", cspHeader);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", cspHeader);
  // Reporting API: names the endpoint referenced by `report-to` above.
  // Absolute URL required by the spec.
  response.headers.set("Reporting-Endpoints", `csp-endpoint="${reportingEndpoint}"`);
  return response;
}

export const config = {
  // Skip static assets and Next.js internals — they're served with their
  // own headers and don't need a per-request nonce. Apply CSP to every
  // dynamic route (pages + API).
  matcher: [
    {
      source:
        "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:webp|png|jpg|jpeg|svg|gif|ico|js|css|mp3|wav|woff2?)).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
