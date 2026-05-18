import bundleAnalyzer from "@next/bundle-analyzer";
import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

// Bundle analyzer — opt-in via `pnpm analyze` (sets ANALYZE=true). Pops
// open the bundle visualization in your browser after build so we can
// keep an eye on what's shipped to the client. Tree-shake regressions
// surface as the first thing a reviewer sees.
const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

/**
 * Static security headers applied to every response. Per-request headers
 * that need entropy (CSP nonce) live in `proxy.ts` — these are the values
 * that never change per request.
 */
const securityHeaders = [
  // 2-year HSTS + preload — once a browser sees this, it refuses
  // plaintext to the apex + all subdomains for two years.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  // Defense against clickjacking. CSP `frame-ancestors 'none'` is the
  // modern equivalent; this is the legacy fallback for older browsers.
  { key: "X-Frame-Options", value: "DENY" },
  // Block MIME-type sniffing — defeats the classic
  // "upload an image that browsers execute as JS" trick.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Send origin only on cross-site requests, full URL same-site.
  // Matches modern UA defaults; explicit so a default flip can't surprise us.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Deny every powerful API by default. fullscreen=(self) is the only
  // allowance — useful for embedded video. Add explicit allowances back
  // when a future feature actually needs them.
  {
    key: "Permissions-Policy",
    value: [
      "accelerometer=()",
      "camera=()",
      "geolocation=()",
      "gyroscope=()",
      "magnetometer=()",
      "microphone=()",
      "payment=()",
      "usb=()",
      "interest-cohort=()",
      "browsing-topics=()",
      "fullscreen=(self)",
    ].join(", "),
  },
  // Cross-Origin-Opener-Policy: opens a fresh browsing-context group, so
  // window.opener / window.parent attacks from popups can't reach back.
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  // Cross-Origin-Resource-Policy: same-origin only. Prevents hot-linking
  // + Spectre-style cross-origin reads.
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  // Don't pre-resolve DNS for outgoing links — privacy hardening.
  { key: "X-DNS-Prefetch-Control", value: "off" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Don't ship the default `X-Powered-By: Next.js` header — small recon
  // win for an attacker, zero functional value.
  poweredByHeader: false,
  // Honor NEXT_DIST_DIR so the Playwright test runner can build into
  // `.next-test/` (isolated from a developer's `pnpm dev` writing to
  // `.next/` on port 3000). Set by `tests/global-setup.ts`.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  // Vercel image-optimization policy. Every `<Image />` source goes
  // through this pipeline; raw `<img>` tags bypass it (intentional for
  // the SVG epigraph in `love-is-the-only-answer.tsx`).
  //
  //  • `formats: [AVIF, WebP]` — AVIF first because the browser-served
  //    file is ~30-50% smaller than WebP at equivalent quality on the
  //    decorative backgrounds; WebP is the older-Safari fallback.
  //  • `qualities: [70, 75, 85]` — the allowlist constrains what
  //    callers can request (per Next 16's tightened image config) so
  //    nobody accidentally requests `quality={100}` and balloons cache.
  //    70 = decorative backgrounds, 75 = default (crowd silhouette),
  //    85 reserved for any future hero / screenshot asset.
  //  • `remotePatterns` is intentionally omitted — every image we
  //    optimize is self-hosted in `public/`. External brand assets
  //    (Coldplay favicon) ride `<link rel="icon">`, not next/image.
  images: {
    formats: ["image/avif", "image/webp"],
    qualities: [70, 75, 85],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

// Composition order: bundle-analyzer wraps the user config first
// (modifies webpack via plugin), then withSentryConfig wraps the
// already-instrumented config to attach the Sentry build plugin for
// source-map upload + release tagging. Reversing the order would let
// Sentry's plugin run BEFORE the analyzer's, hiding analyzer output
// from the source-map upload manifest.
//
// Sentry options:
//  • `org` / `project` — Vercel marketplace integration auto-injects
//    SENTRY_ORG + SENTRY_PROJECT. Hardcoded fallback values would make
//    the repo non-portable; environment-driven keeps it forkable.
//  • `silent: !process.env.CI` — quiet local builds; verbose in CI so
//    source-map upload status appears in the GitHub Actions log.
//  • `telemetry: false` — Sentry's own usage-beacon opt-out. We don't
//    need anonymous build telemetry leaving the build container.
//  • `autoInstrument*: false` — disables Sentry's auto-tracing wrappers
//    around server functions / middleware / app-dir. The OTel SDK
//    (@vercel/otel, registered in `instrumentation.ts`) already
//    emits these spans via fetch-instrumentation. Leaving Sentry's
//    auto-instrumentation on would produce duplicate spans on every
//    request — not duplicate ERRORS (those are deduped) but duplicate
//    perf traces. We chose @vercel/otel as the single trace source.
//  • `automaticVercelMonitors: false` — we don't have Vercel Cron jobs.
const sentryBuildOptions = {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
  telemetry: false,
  autoInstrumentServerFunctions: false,
  autoInstrumentMiddleware: false,
  autoInstrumentAppDirectory: false,
  automaticVercelMonitors: false,
};

export default withSentryConfig(withBundleAnalyzer(nextConfig), sentryBuildOptions);
