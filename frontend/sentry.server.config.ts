import * as Sentry from "@sentry/nextjs";

/**
 * Sentry server-side init (Node.js runtime).
 *
 * Errors-only posture by design: `@vercel/otel` (registered alongside
 * in `instrumentation.ts`) owns tracing — we keep this Sentry SDK
 * focused on unhandled exceptions, captured `console.error`, and
 * explicit `Sentry.captureException` / `Sentry.captureMessage` calls.
 *
 * Why `tracesSampleRate: 0` instead of omitting it:
 *  - `omitted` lets Sentry default to its own auto-instrumented
 *    performance traces, which would duplicate spans already emitted
 *    by `@vercel/otel`'s fetch + HTTP instrumentation.
 *  - `0` is the explicit "do not emit any traces to Sentry" signal.
 *  - Source-map upload + release tracking work regardless of trace
 *    sample rate; we still get readable production stack traces.
 *
 * DSN sourcing: `NEXT_PUBLIC_SENTRY_DSN` is the value Vercel's Sentry
 * marketplace integration auto-injects. Server code can read NEXT_PUBLIC_*
 * vars too. If absent (local dev without `vercel env pull`), Sentry
 * initializes in no-op mode — no errors are emitted anywhere.
 */
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Errors-only. See module docstring for the architectural reasoning.
  tracesSampleRate: 0,
  profilesSampleRate: 0,

  // Default-PII off. We don't store user identifiers and don't want
  // request bodies (which contain the OpenAI prompt) leaking to a
  // third-party error sink.
  sendDefaultPii: false,

  // Environment tag separates prod / preview / dev in the Sentry
  // dashboard so we don't chase preview-deploy noise on a production
  // alert. Vercel sets `VERCEL_ENV` automatically.
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development",

  // Release tag = Vercel deployment Git SHA. Sentry stitches errors
  // to the commit that introduced them (suspect-commit detection)
  // when this is populated. Vercel marketplace integration also
  // creates a Sentry "release" per deploy via SENTRY_AUTH_TOKEN.
  release: process.env.VERCEL_GIT_COMMIT_SHA,
});
