"use server";

import { cookies } from "next/headers";

import { isPlausibleOpenAiKey, verifyKeyInputSchema } from "@/lib/schemas";
import { seal, unseal } from "@/lib/session-crypto";

export interface VerifyKeyResult {
  ok: boolean;
  message: string;
}

const OPENAI_API_KEY_COOKIE = "openai_api_key";
// 24h: short enough to bound key-disclosure blast radius, long enough that
// a normal day's session survives without re-verification.
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
 * Server-side "is the user verified" check. Used by client components that
 * need to re-confirm session validity (e.g. after a long idle). Unseals the
 * cookie and verifies the plaintext key shape — fails closed on any tamper.
 */
export async function hasVerifiedKeyAction(): Promise<boolean> {
  const cookieStore = await cookies();
  const sealed = cookieStore.get(OPENAI_API_KEY_COOKIE)?.value;
  if (typeof sealed !== "string" || sealed.length === 0) {
    return false;
  }
  const decrypted = unseal(sealed);
  return decrypted !== null && isPlausibleOpenAiKey(decrypted);
}

/**
 * Powers the Disconnect button in `ConnectionStatusCard`: clears the
 * sealed key cookie server-side so the next request is unverified.
 */
export async function clearVerifiedKeyAction(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(OPENAI_API_KEY_COOKIE);
}
