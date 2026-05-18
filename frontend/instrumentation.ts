import { registerOTel } from "@vercel/otel";

/**
 * Next.js 16 server-side instrumentation hook.
 *
 * `@vercel/otel` wires up the OpenTelemetry SDK with sane defaults:
 *  - Auto-instruments `fetch` calls (so the outbound OpenAI request
 *    appears as a child HTTP span without manual wrapping).
 *  - Adds Vercel deployment context (deployment.id, cloud.region,
 *    vcs.ref.head.revision, etc.) to every exported span.
 *  - Routes spans to the Vercel OTLP collector when deployed; no-ops
 *    locally (no exporter configured = traces stay in process and
 *    drop on shutdown, which is the correct local-dev behavior).
 *
 * GenAI-specific span attributes (gen_ai.system, gen_ai.request.model,
 * gen_ai.usage.input_tokens, gen_ai.usage.output_tokens, llm.cost_usd)
 * are set manually in `app/api/chat/route.ts` — auto-instrumentation
 * gives us the HTTP + fetch envelope; LLM semantic conventions need
 * application-level knowledge to populate correctly.
 *
 * @see https://opentelemetry.io/docs/specs/semconv/gen-ai/ (semantic conv)
 * @see https://vercel.com/docs/observability/otel-overview (Vercel sink)
 */
export function register(): void {
  registerOTel({ serviceName: "coldplay-ai-companion" });
}
