import { NextResponse } from "next/server";

import { isSameOrigin } from "@/lib/csrf";
import { verifyAndStoreKey } from "@/lib/data/auth";
import { checkRateLimit, getClientKey } from "@/lib/rate-limit";
import { verifyKeyRequestSchema } from "@/lib/schemas";

/**
 * POST /api/verify-key
 *
 * Why this is a route handler, not a Server Action: Next.js logs Server
 * Action arguments to the dev-mode (`pnpm dev`) terminal. With a
 * `verifyOpenAiKeyAction(rawKey)` signature, the raw sk-... key landed
 * in dev stdout every time a developer verified locally. Route handlers
 * do NOT log their request bodies, so this endpoint closes that
 * developer-class secret leak. Production was already unaffected.
 *
 * IMPORTANT: do NOT add any `console.log` of `body`, `parsed.data`, or
 * any string that could contain the key. A single rogue log would undo
 * the entire purpose of this migration.
 */

export const runtime = "nodejs";

// 1KB body cap. Verify body is `{"key":"sk-..."}`, max ~280 bytes for a
// 256-char key + JSON wrapper. Anything materially larger is junk or
// an attempt to exhaust the JSON parser before zod validation.
const MAX_REQUEST_BODY_BYTES = 1 * 1024;

export async function POST(request: Request): Promise<Response> {
  const requestId = crypto.randomUUID();

  // Cheapest guard first — drops obvious cross-site abuse before any
  // body parsing or upstream OpenAI call.
  if (!isSameOrigin(request)) {
    return NextResponse.json(
      { detail: "Cross-origin requests are not permitted." },
      { status: 403, headers: { "x-request-id": requestId } }
    );
  }

  // Per-IP sliding-window rate limit. Shared bucket with /api/chat
  // so an abusive verify burst consumes the same client's chat
  // budget — a feature for abuse prevention, not a bug.
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

  // Content-Length pre-check — cheap reject before we buffer the body.
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

  const parsed = verifyKeyRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { detail: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400, headers: { "x-request-id": requestId } }
    );
  }

  // Delegate to the DAL — it does OpenAI ping + AES-256-GCM seal +
  // httpOnly/sameSite=strict cookie set + UI-facing DTO. `parsed.data.key`
  // is passed once and immediately goes out of scope; the key never
  // touches a log statement on this call path.
  const result = await verifyAndStoreKey(parsed.data.key);

  // 200 even for `ok: false` credential rejection — the REQUEST was
  // well-formed; OpenAI declined the credential. Mirrors the Server
  // Action contract so the client's error-handling code is unchanged.
  return NextResponse.json(result, {
    status: 200,
    headers: { "x-request-id": requestId },
  });
}
