import { NextResponse } from "next/server";

import { isSameOrigin } from "@/lib/csrf";
import { getVerifiedKey } from "@/lib/data/auth";
import { serverEnv } from "@/lib/env";
import { checkRateLimit, getClientKey } from "@/lib/rate-limit";
import {
  chatRequestSchema,
  openAiErrorResponseSchema,
  openAiStreamChunkSchema,
} from "@/lib/schemas";

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

const COLDPLAY_SYSTEM_PROMPT = [
  "You are a Coldplay-only assistant. Answer only questions about Coldplay, ",
  "including members, albums, songs, tours, timelines, and related official ",
  "context. If the user asks about non-Coldplay topics, politely refuse and ",
  "redirect to Coldplay-focused help.\n\n",
  "Formatting rules (always follow these):\n",
  "- Use markdown. Wrap ALL proper nouns in **bold**: band names (Coldplay), ",
  "member full names (Chris Martin, Jonny Buckland, Guy Berryman, Will Champion), ",
  "song titles, album titles, tour names, EP names, label names, collaborator ",
  "names, and venue names.\n",
  "- Use numbered lists for sequences (members, timelines, chronological items).\n",
  "- Use bullet lists for related non-sequential items.\n",
  "- Keep paragraphs concise (2-3 sentences max where possible).\n",
  "- Italicize emotional/descriptive phrases sparingly with *single asterisks*.\n",
  "- Do not use headings (#) inline — keep responses flowing prose + lists.",
].join("");

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

  let upstream: Response;
  try {
    upstream = await fetch(OPENAI_CHAT_COMPLETIONS_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [
          { role: "system", content: COLDPLAY_SYSTEM_PROMPT },
          { role: "user", content: parsed.data.message },
        ],
        stream: true,
        max_completion_tokens: OPENAI_MAX_TOKENS,
      }),
      signal: timeoutController.signal,
    });
  } catch (error) {
    clearTimeout(timeoutHandle);
    if (error instanceof DOMException && error.name === "AbortError") {
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
    return NextResponse.json(
      { detail },
      { status: upstream.status, headers: { "x-request-id": requestId } }
    );
  }

  if (!upstream.body) {
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
            } catch {
              // Malformed/unsupported chunk shape — skip rather than tear
              // down the whole stream for the user.
            }
          }
        }
      } catch (error) {
        controller.error(error);
        return;
      } finally {
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
