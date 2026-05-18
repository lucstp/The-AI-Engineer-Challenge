import { z } from "zod";

/**
 * Type-safe environment validation at module load.
 *
 * Catches missing or malformed env vars at startup rather than at first
 * user request — fail loud at boot, not silently at runtime. Server vars
 * are not exposed to the client bundle (this module is server-only).
 *
 * Usage:
 *   import { serverEnv } from "@/lib/env";
 *   serverEnv.OPENAI_MODEL    // string, validated
 *   serverEnv.SESSION_SECRET  // string, length + entropy enforced
 *
 */

const SESSION_SECRET_MIN_CHARS_NON_PROD = 32;
const SESSION_SECRET_MIN_CHARS_PROD = 48;
const SESSION_SECRET_MIN_ENTROPY_PROD = 3.0;

/**
 * Shannon entropy in bits per character. A truly-random base64 string
 * sits around 5.5–6.0; lazy "password123" patterns sit below 3. The
 * production gate rejects anything below 3 bits/char so SESSION_SECRET
 * can't be hand-typed in a moment of weakness.
 */
function shannonEntropyBitsPerChar(input: string): number {
  if (input.length === 0) return 0;
  const counts = new Map<string, number>();
  for (const ch of input) {
    counts.set(ch, (counts.get(ch) ?? 0) + 1);
  }
  let bits = 0;
  for (const count of counts.values()) {
    const p = count / input.length;
    bits -= p * Math.log2(p);
  }
  return bits;
}

const serverEnvSchema = z.object({
  OPENAI_MODEL: z.string().trim().min(1).default("gpt-4.1-mini"),
  // 4000 is the safe ceiling across every MODELS entry (`lib/constants.ts`).
  // Reasoning models (gpt-5 family) burn hundreds of tokens on silent
  // chain-of-thought BEFORE emitting any content delta — a too-low cap
  // exhausts the budget on reasoning → empty stream → "assistant
  // returned an empty response." Non-reasoning models simply don't use
  // the headroom. This env var is now a HARD CEILING the route applies
  // on top of the per-model cap: `min(model.maxCompletionTokens, env)`.
  // Operator override still wins.
  OPENAI_MAX_COMPLETION_TOKENS: z.coerce.number().int().positive().default(4000),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  // Used by lib/session-crypto.ts to AES-256-GCM-seal the OpenAI key cookie.
  // Generate with: openssl rand -base64 48
  //   • Non-prod: >= 32 chars (so tests / dev can pin a fixed value)
  //   • Production: >= 48 chars AND >= 3 bits/char Shannon entropy
  // The length-by-environment + entropy check are enforced post-parse so
  // they can read NODE_ENV (which is itself parsed by this same schema).
  SESSION_SECRET: z.string(),
  // Optional. When both are present, /api/chat rate-limits via Upstash
  // sliding window. Vercel's Upstash Marketplace integration sets these
  // canonical names when no custom prefix is configured. Absence triggers
  // the per-instance in-memory fallback with a loud production warning.
  KV_REST_API_URL: z.string().url().optional(),
  KV_REST_API_TOKEN: z.string().min(1).optional(),
  // Optional. Public URL of the Pond5 "Aerophonia" full track on Vercel
  // Blob (https://[storeId].public.blob.vercel-storage.com/<file>). When
  // set, /api/audio/aerophonia proxy-streams from the CDN. Absent, the
  // route falls back to private/audio/aerophonia-full.mp3 (dev only).
  // The route allow-lists the host suffix `.public.blob.vercel-storage.com`
  // so a tampered env var cannot redirect the fetch elsewhere.
  BLOB_AUDIO_AEROPHONIA_URL: z.string().url().optional(),
});

function parseEnv<T extends z.ZodTypeAny>(
  schema: T,
  source: Record<string, string | undefined>
): z.infer<T> {
  const result = schema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment variables:\n${issues}`);
  }
  return result.data;
}

/** Server-only env. Do NOT import from a client component. */
export const serverEnv = parseEnv(serverEnvSchema, {
  OPENAI_MODEL: process.env.OPENAI_MODEL,
  OPENAI_MAX_COMPLETION_TOKENS: process.env.OPENAI_MAX_COMPLETION_TOKENS,
  NODE_ENV: process.env.NODE_ENV,
  SESSION_SECRET: process.env.SESSION_SECRET,
  KV_REST_API_URL: process.env.KV_REST_API_URL,
  KV_REST_API_TOKEN: process.env.KV_REST_API_TOKEN,
  BLOB_AUDIO_AEROPHONIA_URL: process.env.BLOB_AUDIO_AEROPHONIA_URL,
});

// Environment-aware SESSION_SECRET strength gate. Runs at module load —
// failure here throws before any handler can serve a request.
const sessionSecretMinChars =
  serverEnv.NODE_ENV === "production"
    ? SESSION_SECRET_MIN_CHARS_PROD
    : SESSION_SECRET_MIN_CHARS_NON_PROD;
if (serverEnv.SESSION_SECRET.length < sessionSecretMinChars) {
  throw new Error(
    `SESSION_SECRET must be at least ${sessionSecretMinChars} characters in ${serverEnv.NODE_ENV}. Generate with: openssl rand -base64 48`
  );
}
if (serverEnv.NODE_ENV === "production") {
  const entropy = shannonEntropyBitsPerChar(serverEnv.SESSION_SECRET);
  if (entropy < SESSION_SECRET_MIN_ENTROPY_PROD) {
    throw new Error(
      `SESSION_SECRET entropy is ${entropy.toFixed(2)} bits/char; production requires >= ${SESSION_SECRET_MIN_ENTROPY_PROD}. Use 'openssl rand -base64 48' — do not hand-type the value.`
    );
  }
}
