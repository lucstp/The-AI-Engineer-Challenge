import { cookies } from "next/headers";

import { isPlausibleOpenAiKey } from "@/lib/schemas";
import { seal, unseal } from "@/lib/session-crypto";

/**
 * Data Access Layer for the OpenAI key session.
 *
 * Single source of truth for the verified-key lifecycle: verify against
 * OpenAI, seal + store in cookie, read + unseal, clear. Per Next.js's
 * Data Security guide, Server Actions and route handlers delegate here
 * instead of each duplicating cookie / crypto / OpenAI logic at the
 * call site. Module is server-only by virtue of `next/headers` — that
 * import throws on the client, so accidental client-side use fails fast
 * at runtime.
 */

const OPENAI_API_KEY_COOKIE = "openai_api_key";
// 24h: short enough to bound key-disclosure blast radius, long enough that
// a normal day's session survives without re-verification.
const SESSION_TTL_SECONDS = 60 * 60 * 24;

const OPENAI_MODELS_ENDPOINT = "https://api.openai.com/v1/models";

export interface VerifyKeyResult {
  ok: boolean;
  message: string;
}

/**
 * Verify a candidate OpenAI key against the live `/v1/models` endpoint.
 * On success, seal with AES-256-GCM and store as an httpOnly,
 * sameSite=strict cookie. Returns a UI-facing DTO — never exposes the
 * plaintext key in the result shape.
 *
 * Caller responsibility: pass an already-schema-validated string. The
 * DAL trusts its input here because the action layer (`app/actions.ts`)
 * is the boundary that runs the zod schema. The route handler in
 * `/api/chat` does not call this — it only reads via `getVerifiedKey`.
 */
export async function verifyAndStoreKey(key: string): Promise<VerifyKeyResult> {
  try {
    const response = await fetch(OPENAI_MODELS_ENDPOINT, {
      method: "GET",
      headers: { Authorization: `Bearer ${key}` },
      cache: "no-store",
    });

    if (response.ok) {
      const cookieStore = await cookies();
      // Seal the key with AES-256-GCM before it ever lands in the cookie
      // jar. Cookie disclosure (logs, browser-ext, OS-level inspection)
      // yields only an opaque blob without SESSION_SECRET.
      cookieStore.set(OPENAI_API_KEY_COOKIE, seal(key), {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        // strict (not lax): cross-site navigation must NOT carry this
        // key cookie. App is single-origin; strict has zero UX cost.
        sameSite: "strict",
        path: "/",
        maxAge: SESSION_TTL_SECONDS,
      });
      return { ok: true, message: "Key verified. You can start chatting." };
    }

    if (response.status === 401) {
      return {
        ok: false,
        message: "This key is invalid, revoked, or expired. Please check and try again.",
      };
    }

    if (response.status === 429) {
      return {
        ok: true,
        message:
          "Key is recognized, but your account appears rate-limited right now. Chat may still fail until limits reset.",
      };
    }

    return {
      ok: false,
      message: `Validation failed with status ${response.status}. Please retry in a moment.`,
    };
  } catch {
    return {
      ok: false,
      message: "Could not reach OpenAI for validation. Check your network and try again.",
    };
  }
}

/**
 * Read the verified key plaintext from the sealed cookie. Returns `null`
 * on ANY tamper, absence, decrypt failure, or shape mismatch — callers
 * MUST handle `null` as "no valid session" and never trust a partial
 * decrypt. This is the single read path; route handlers and actions both
 * consume from here.
 */
export async function getVerifiedKey(): Promise<string | null> {
  const cookieStore = await cookies();
  const sealed = cookieStore.get(OPENAI_API_KEY_COOKIE)?.value;
  if (typeof sealed !== "string" || sealed.length === 0) {
    return null;
  }
  const decrypted = unseal(sealed);
  if (decrypted === null || !isPlausibleOpenAiKey(decrypted)) {
    return null;
  }
  return decrypted;
}

/**
 * Boolean form of `getVerifiedKey` for callers that don't need the key
 * itself (e.g., gating UI visibility from a Server Action).
 */
export async function hasVerifiedKey(): Promise<boolean> {
  return (await getVerifiedKey()) !== null;
}

/**
 * Delete the sealed key cookie. The next request from this client is
 * unverified.
 */
export async function clearVerifiedKey(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(OPENAI_API_KEY_COOKIE);
}
