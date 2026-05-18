import { registerOTel } from "@vercel/otel";

/**
 * Next.js 16 server-side instrumentation hook.
 *
 * Two SDKs register here, with non-overlapping concerns:
 *
 *  1. `@vercel/otel` — emits OpenTelemetry traces with GenAI semantic
 *     conventions (model, token usage, cost). Auto-instruments `fetch`
 *     and HTTP. Routes to Vercel Observability when deployed; no-op
 *     locally. Custom GenAI attributes set in `app/api/chat/route.ts`.
 *
 *  2. `@sentry/nextjs` — errors-only sink. Both server (Node) and edge
 *     SDKs init via `sentry.{server,edge}.config.ts`, runtime-gated
 *     below. `tracesSampleRate: 0` in those configs prevents Sentry
 *     from emitting duplicate spans the OTel side already covers.
 *
 * `onRequestError` is required for the App Router — without it,
 * server-side React rendering errors don't reach the Sentry SDK.
 * Re-exported from `@sentry/nextjs`.
 *
 * @see https://opentelemetry.io/docs/specs/semconv/gen-ai/
 * @see https://vercel.com/docs/observability/otel-overview
 * @see https://docs.sentry.io/platforms/javascript/guides/nextjs/
 */
export async function register(): Promise<void> {
  registerOTel({ serviceName: "coldplay-ai-companion" });

  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export { captureRequestError as onRequestError } from "@sentry/nextjs";
