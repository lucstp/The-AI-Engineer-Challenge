import * as Sentry from "@sentry/nextjs";

/**
 * Sentry edge-runtime init (used by `proxy.ts` middleware).
 *
 * Same posture as the Node config: errors-only, no tracing
 * (`@vercel/otel` owns traces). The Edge runtime has a more limited
 * Sentry feature set than Node — no profiling, restricted integrations
 * — so the init signature is intentionally minimal.
 */
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0,
  sendDefaultPii: false,
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development",
  release: process.env.VERCEL_GIT_COMMIT_SHA,
});
