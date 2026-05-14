import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

import { serverEnv } from "@/lib/env";

/**
 * Authenticated symmetric encryption for cookie values (AES-256-GCM).
 *
 * Threat model: the raw OpenAI API key must never appear in any log, header
 * dump, browser cookie jar, or extension's `cookies` query. Wrapping it in
 * an AES-GCM seal means even full cookie-jar disclosure yields only an
 * opaque blob without the SESSION_SECRET — which only the server runtime
 * holds (Vercel env var, never shipped to the client bundle).
 *
 * Why AES-256-GCM:
 *  - Authenticated encryption (auth tag detects tampering)
 *  - NIST-approved, AEAD by construction (no separate MAC needed)
 *  - Native to Node's `crypto` (zero dependencies)
 *
 * Format: `b64url(iv).b64url(ciphertext).b64url(authTag)`. Dot is safe in
 * cookie values (RFC 6265 cookie-octet). base64url avoids URL-encoding
 * surprises if a future code path log-rounds-trips the value.
 */

const ALGORITHM = "aes-256-gcm";
const IV_BYTE_LENGTH = 12;
const SEPARATOR = ".";

let cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (cachedKey === null) {
    // SHA-256 collapses any-length secret to a stable 32-byte AES-256 key.
    // SESSION_SECRET is already required to be ≥32 chars (env.ts), giving
    // ≥256 bits of input entropy — a single SHA-256 is appropriate here
    // (HKDF would add ceremony without changing the security ceiling).
    cachedKey = createHash("sha256").update(serverEnv.SESSION_SECRET).digest();
  }
  return cachedKey;
}

export function seal(plaintext: string): string {
  const iv = randomBytes(IV_BYTE_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [
    iv.toString("base64url"),
    ciphertext.toString("base64url"),
    authTag.toString("base64url"),
  ].join(SEPARATOR);
}

/**
 * Returns null on ANY decryption failure: malformed input, wrong secret,
 * tampered ciphertext, mismatched auth tag. Callers MUST handle null as
 * "no valid session" and never trust a partial decrypt.
 */
export function unseal(sealedValue: string): string | null {
  const parts = sealedValue.split(SEPARATOR);
  if (parts.length !== 3) return null;
  const [ivPart, ciphertextPart, authTagPart] = parts;
  if (!ivPart || !ciphertextPart || !authTagPart) return null;

  try {
    const iv = Buffer.from(ivPart, "base64url");
    const ciphertext = Buffer.from(ciphertextPart, "base64url");
    const authTag = Buffer.from(authTagPart, "base64url");
    if (iv.length !== IV_BYTE_LENGTH) return null;

    const decipher = createDecipheriv(ALGORITHM, getKey(), iv);
    decipher.setAuthTag(authTag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return plaintext.toString("utf8");
  } catch {
    return null;
  }
}
