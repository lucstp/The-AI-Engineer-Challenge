"use server";

import { cookies } from "next/headers";

import { verifyKeyInputSchema } from "@/lib/schemas";

export interface VerifyKeyResult {
  ok: boolean;
  message: string;
}

const OPENAI_API_KEY_COOKIE = "openai_api_key";
// 24h: short enough to bound key-disclosure blast radius, long enough that
// a normal day's session survives without re-verification. PR 7 (cookie
// security) wraps the raw value with AES-256-GCM seal and tightens
// sameSite to "strict".
const SESSION_TTL_SECONDS = 60 * 60 * 24;

export async function verifyOpenAiKeyAction(rawKey: string): Promise<VerifyKeyResult> {
  const parsed = verifyKeyInputSchema.safeParse(rawKey);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Invalid key format. OpenAI keys usually start with 'sk-' and are longer.",
    };
  }
  const key = parsed.data;

  try {
    const response = await fetch("https://api.openai.com/v1/models", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${key}`,
      },
      cache: "no-store",
    });

    if (response.ok) {
      const cookieStore = await cookies();
      // Raw key for now — PR 7 wraps with AES-256-GCM seal so cookie
      // disclosure (logs, browser-ext, OS-level inspection) only yields
      // an opaque blob without SESSION_SECRET. Same-site policy also
      // tightens to "strict" in PR 7.
      cookieStore.set(OPENAI_API_KEY_COOKIE, key, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
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
 * Powers the Disconnect button in `ConnectionStatusCard`: clears the
 * key cookie server-side so the next request is unverified. Hardened in
 * PR 7 with sealed-cookie deletion semantics + structured logging.
 */
export async function clearVerifiedKeyAction(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(OPENAI_API_KEY_COOKIE);
}
