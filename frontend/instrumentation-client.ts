import * as Sentry from "@sentry/nextjs";

/**
 * Sentry browser SDK init.
 *
 * Next.js 16 calls this module's top-level code once during client
 * bootstrap. The exported `onRouterTransitionStart` hook (re-exported
 * from `@sentry/nextjs`) is invoked on every client-side navigation
 * so Sentry can scope errors to the current route. Required for
 * accurate breadcrumbs on App Router navigations.
 *
 * Errors-only posture: see `sentry.server.config.ts` for the rationale.
 * `@vercel/otel` (server-side) owns traces — Sentry just sinks errors.
 * Browser performance metrics live in `@vercel/speed-insights` (already
 * shipped), so we don't reintroduce them here.
 */
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Errors-only.
  tracesSampleRate: 0,

  // No session replay. Replay is a privacy-sensitive feature (records
  // DOM mutations + user input) that requires explicit consent UI we
  // haven't built. Keeping both rates at 0 makes the SDK skip the
  // replay integration entirely.
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,

  sendDefaultPii: false,

  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV ?? "development",
  release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,

  // Browser-side noise filter. These aren't app bugs — they're either
  // browser-extension interference or network failures outside our
  // control. Filtering at SDK level (rather than at Sentry-server
  // ingest rules) keeps the Developer-tier event quota free for real
  // issues.
  ignoreErrors: [
    // ResizeObserver noise — every browser emits this on certain layout
    // shifts. Not actionable.
    "ResizeObserver loop limit exceeded",
    "ResizeObserver loop completed with undelivered notifications",
    // Ad-blocker / DNS-poisoned-ads network failures. The toast UI
    // already shows the user a retry option for chat-route failures
    // we DO care about.
    "TypeError: Failed to fetch",
    "TypeError: NetworkError when attempting to fetch resource.",
    // Safari-only quirk — Apple's autocomplete throws during form fills.
    "Non-Error promise rejection captured with value: Object Not Found Matching Id",
  ],
});

// Required for Next.js App Router — Sentry uses this hook to scope
// in-flight transactions to the new route. Without it, navigation
// breadcrumbs lose attribution. Re-exported by @sentry/nextjs.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
