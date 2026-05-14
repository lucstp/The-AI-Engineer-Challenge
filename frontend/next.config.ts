import type { NextConfig } from "next";

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
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
