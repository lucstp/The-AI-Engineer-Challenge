import { SpanStatusCode, trace } from "@opentelemetry/api";
import { NextResponse } from "next/server";

import { MODELS } from "@/lib/constants";
import { isSameOrigin } from "@/lib/csrf";
import { getVerifiedKey } from "@/lib/data/auth";
import { serverEnv } from "@/lib/env";
import { computeChatCostUsd } from "@/lib/llm-pricing";
import { checkRateLimit, getClientKey } from "@/lib/rate-limit";
import {
  chatRequestSchema,
  openAiErrorResponseSchema,
  openAiStreamChunkSchema,
} from "@/lib/schemas";
import { COLDPLAY_SYSTEM_PROMPT } from "@/lib/system-prompt";

// OTel tracer for the OpenAI chat operation. The Vercel-wired SDK
// (see `instrumentation.ts`) auto-instruments the outbound `fetch` —
// this manual span exists to carry GenAI semantic-convention attributes
// the fetch-instrumentation does not know about (model, token usage,
// cost, finish reason). See OTel GenAI semantic conventions:
// https://opentelemetry.io/docs/specs/semconv/gen-ai/
const tracer = trace.getTracer("ai-engineer-challenge.chat");

export const runtime = "nodejs";

const OPENAI_CHAT_COMPLETIONS_ENDPOINT = "https://api.openai.com/v1/chat/completions";
const OPENAI_TIMEOUT_MS = 60_000;
const OPENAI_MODEL = serverEnv.OPENAI_MODEL;
const OPENAI_MAX_TOKENS = serverEnv.OPENAI_MAX_COMPLETION_TOKENS;
// 8KB body cap. chatRequestSchema caps `message` at 4000 chars; a well-formed
// payload is well under this. A larger Content-Length is by definition either
// junk wrapping or an attempt to exhaust the JSON parser before validation.
const MAX_REQUEST_BODY_BYTES = 8 * 1024;
// 64KB upstream SSE buffer cap. A misbehaving upstream that never emits a
// newline could accumulate unbounded memory in the chunk buffer; this cap
// tears the stream down before that happens.
const MAX_SSE_BUFFER_BYTES = 64 * 1024;

export async function POST(request: Request): Promise<Response> {
  const requestId = crypto.randomUUID();

  // Cheapest guard first — drops obvious cross-site abuse before we
  // touch JSON parsing, cookie storage, or the upstream OpenAI fetch.
  if (!isSameOrigin(request)) {
    return NextResponse.json(
      { detail: "Cross-origin requests are not permitted." },
      { status: 403, headers: { "x-request-id": requestId } }
    );
  }

  // Per-IP sliding-window rate limit runs before any auth/parse work —
  // each chat request becomes a paid OpenAI call downstream, so the
  // cheapest place to shed abusive floods is here.
  const rateLimit = await checkRateLimit(getClientKey(request));
  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        detail: `Too many requests. Please wait ${rateLimit.retryAfterSec}s and try again.`,
      },
      {
        status: 429,
        headers: {
          "x-request-id": requestId,
          "Retry-After": String(rateLimit.retryAfterSec),
          "X-RateLimit-Remaining": String(rateLimit.remaining),
          "X-RateLimit-Reset": String(rateLimit.resetAt),
        },
      }
    );
  }

  // Content-Length pre-check: cheap reject before we buffer the body.
  const contentLengthHeader = request.headers.get("content-length");
  if (contentLengthHeader !== null) {
    const declared = Number(contentLengthHeader);
    if (Number.isFinite(declared) && declared > MAX_REQUEST_BODY_BYTES) {
      return NextResponse.json(
        { detail: "Request body too large." },
        { status: 413, headers: { "x-request-id": requestId } }
      );
    }
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { detail: "Invalid JSON body." },
      { status: 400, headers: { "x-request-id": requestId } }
    );
  }

  const parsed = chatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { detail: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400, headers: { "x-request-id": requestId } }
    );
  }

  // DAL handles cookie read + AES-256-GCM unseal + key-shape validation
  // in one call. Returns null on ANY tamper, absence, decrypt failure, or
  // shape mismatch — fail closed. See `lib/data/auth.ts`.
  const apiKey = await getVerifiedKey();
  if (apiKey === null) {
    return NextResponse.json(
      { detail: "OpenAI key not verified. Please re-enter your key." },
      { status: 401, headers: { "x-request-id": requestId } }
    );
  }

  const timeoutController = new AbortController();
  const timeoutHandle = setTimeout(() => timeoutController.abort(), OPENAI_TIMEOUT_MS);

  // Resolve model + per-model token cap from the validated dropdown allowlist.
  // Absent `parsed.data.model` falls back to env's OPENAI_MODEL (legacy direct-
  // API callers + operator default). The env `OPENAI_MAX_COMPLETION_TOKENS`
  // acts as a hard ceiling above the per-model cap so operators retain
  // override authority: `min(model.cap, env)`.
  const requestedModel = parsed.data.model ?? OPENAI_MODEL;
  const modelConfig = MODELS.find((m) => m.id === requestedModel);
  const modelCap = modelConfig?.maxCompletionTokens ?? OPENAI_MAX_TOKENS;
  const effectiveCap = Math.min(modelCap, OPENAI_MAX_TOKENS);

  // Start the OTel span for the OpenAI operation. Initial attributes
  // follow GenAI semantic conventions; the response attributes
  // (token usage, finish reason, cost) get populated when the stream
  // completes. The span MUST be ended on every exit path — we'd leak
  // an open span otherwise, which silently inflates trace counts in
  // dashboards and prevents flush-on-shutdown from completing.
  const span = tracer.startSpan("openai.chat.completions", {
    attributes: {
      "gen_ai.system": "openai",
      "gen_ai.operation.name": "chat",
      "gen_ai.request.model": requestedModel,
      "gen_ai.request.max_tokens": effectiveCap,
      "gen_ai.request.streaming": true,
      // Non-standard: client correlation key. Surfaces the same
      // `x-request-id` returned to the browser in the trace so we can
      // pivot from a frontend error toast to its server-side span.
      "ai_engineer_challenge.request_id": requestId,
    },
  });

  let upstream: Response;
  try {
    upstream = await fetch(OPENAI_CHAT_COMPLETIONS_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: requestedModel,
        messages: [
          { role: "system", content: COLDPLAY_SYSTEM_PROMPT },
          { role: "user", content: parsed.data.message },
        ],
        stream: true,
        // Required for the final usage chunk OpenAI emits at stream
        // end (empty `choices`, populated `usage`). Without this flag
        // we can't emit `gen_ai.usage.*` attributes.
        stream_options: { include_usage: true },
        max_completion_tokens: effectiveCap,
      }),
      signal: timeoutController.signal,
    });
  } catch (error) {
    clearTimeout(timeoutHandle);
    const isTimeout = error instanceof DOMException && error.name === "AbortError";
    span.recordException(error instanceof Error ? error : new Error(String(error)));
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: isTimeout ? "openai_fetch_timeout" : "openai_fetch_failed",
    });
    span.end();
    if (isTimeout) {
      return NextResponse.json(
        { detail: "Upstream OpenAI request timed out." },
        { status: 504, headers: { "x-request-id": requestId } }
      );
    }
    return NextResponse.json(
      { detail: "Failed to reach OpenAI." },
      { status: 502, headers: { "x-request-id": requestId } }
    );
  }

  clearTimeout(timeoutHandle);

  if (!upstream.ok) {
    let detail = "OpenAI returned an error.";
    try {
      const errorRaw = await upstream.json();
      const errorParsed = openAiErrorResponseSchema.safeParse(errorRaw);
      if (errorParsed.success) {
        detail = errorParsed.data.error.message;
      }
    } catch {
      // ignore unparseable upstream error body
    }
    span.setAttribute("http.response.status_code", upstream.status);
    span.setStatus({ code: SpanStatusCode.ERROR, message: "openai_non_2xx" });
    span.end();
    return NextResponse.json(
      { detail },
      { status: upstream.status, headers: { "x-request-id": requestId } }
    );
  }

  if (!upstream.body) {
    span.setStatus({ code: SpanStatusCode.ERROR, message: "openai_no_body" });
    span.end();
    return NextResponse.json(
      { detail: "Upstream returned no stream body." },
      { status: 502, headers: { "x-request-id": requestId } }
    );
  }

  // Pipe OpenAI SSE → plain text content deltas. We strip the SSE
  // envelope on the server so the client (streamChatMessage) stays simple:
  // it just decodes UTF-8 chunks and appends them to the rendered message.
  //
  // Capture `upstream.body` in a local first — the !=null narrowing above
  // doesn't survive the ReadableStream-constructor closure boundary, and a
  // non-null assertion (upstream.body!) trips biome's noNonNullAssertion.
  const upstreamBody = upstream.body;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = upstreamBody.getReader();
      const decoder = new TextDecoder();
      const encoder = new TextEncoder();
      let buffer = "";

      // Captured for the OTel span at stream end. Populated from
      // validated chunks as they arrive; nullable so we can omit the
      // corresponding attribute when OpenAI doesn't return that field.
      let responseModel: string | undefined;
      let finishReason: string | undefined;
      let inputTokens: number | undefined;
      let outputTokens: number | undefined;
      let reasoningTokens: number | undefined;
      let streamErrored = false;

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }
          if (!value) {
            continue;
          }

          buffer += decoder.decode(value, { stream: true });
          if (buffer.length > MAX_SSE_BUFFER_BYTES) {
            // Defense against an upstream that streams without newlines —
            // unbounded buffer growth would leak memory. Tear it down.
            streamErrored = true;
            controller.error(new Error("Upstream SSE buffer exceeded cap"));
            return;
          }
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const rawLine of lines) {
            const line = rawLine.trim();
            if (!line.startsWith("data:")) {
              continue;
            }
            const payload = line.slice(5).trim();
            if (!payload || payload === "[DONE]") {
              continue;
            }

            try {
              const chunk = openAiStreamChunkSchema.parse(JSON.parse(payload));
              const content = chunk.choices[0]?.delta.content;
              if (typeof content === "string" && content.length > 0) {
                controller.enqueue(encoder.encode(content));
              }
              // GenAI semantic-convention bookkeeping. The response
              // model may differ from the request model when OpenAI
              // routes the request to a versioned snapshot
              // (e.g. `gpt-5-mini-2026-01-01`). The final usage chunk
              // arrives with empty `choices` + populated `usage`.
              if (chunk.model && !responseModel) {
                responseModel = chunk.model;
              }
              const chunkFinishReason = chunk.choices[0]?.finish_reason;
              if (typeof chunkFinishReason === "string") {
                finishReason = chunkFinishReason;
              }
              if (chunk.usage) {
                inputTokens = chunk.usage.prompt_tokens;
                outputTokens = chunk.usage.completion_tokens;
                reasoningTokens = chunk.usage.completion_tokens_details?.reasoning_tokens;
              }
            } catch {
              // Malformed/unsupported chunk shape — skip rather than tear
              // down the whole stream for the user.
            }
          }
        }
      } catch (error) {
        streamErrored = true;
        span.recordException(error instanceof Error ? error : new Error(String(error)));
        span.setStatus({ code: SpanStatusCode.ERROR, message: "stream_processing_failed" });
        controller.error(error);
        return;
      } finally {
        // Finalize the OTel span with whatever GenAI attributes we
        // captured. Set BEFORE end(); attributes added after end() are
        // dropped silently by the SDK. The span outlives the Response
        // return because we hold the ref in this closure.
        if (responseModel) {
          span.setAttribute("gen_ai.response.model", responseModel);
        }
        if (finishReason) {
          // GenAI spec models finish reasons as an array (one per
          // choice). Streaming chat completion has one choice.
          span.setAttribute("gen_ai.response.finish_reasons", [finishReason]);
        }
        if (inputTokens !== undefined) {
          span.setAttribute("gen_ai.usage.input_tokens", inputTokens);
        }
        if (outputTokens !== undefined) {
          span.setAttribute("gen_ai.usage.output_tokens", outputTokens);
        }
        if (reasoningTokens !== undefined) {
          // Non-standard but parallel to GenAI naming. Reasoning models
          // (gpt-5 family) bill chain-of-thought tokens separately from
          // visible-content tokens; surfacing this makes cost dashboards
          // distinguish "I had to think hard" from "I had to write a lot."
          span.setAttribute("gen_ai.usage.reasoning_tokens", reasoningTokens);
        }
        if (inputTokens !== undefined && outputTokens !== undefined) {
          const cost = computeChatCostUsd(requestedModel, inputTokens, outputTokens);
          if (cost !== undefined) {
            // Non-standard. Approximate USD cost derived from the
            // model pricing table in `lib/llm-pricing.ts`. Token
            // attributes above are the canonical signal; cost is
            // a derived convenience.
            span.setAttribute("llm.cost_usd", cost);
          }
        }
        if (!streamErrored) {
          span.setStatus({ code: SpanStatusCode.OK });
        }
        span.end();
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "x-request-id": requestId,
    },
  });
}
