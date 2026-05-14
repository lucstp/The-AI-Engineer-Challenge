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
 * Future PRs extend this schema as new env vars arrive:
 *   • PR 8  → KV_REST_API_URL + KV_REST_API_TOKEN (Upstash rate limit)
 *   • PR 14 → BLOB_AUDIO_AEROPHONIA_URL (Vercel Blob audio source)
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
  OPENAI_MODEL: z.string().trim().min(1).default("gpt-5"),
  OPENAI_MAX_COMPLETION_TOKENS: z.coerce.number().int().positive().default(280),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  // Used by lib/session-crypto.ts to AES-256-GCM-seal the OpenAI key cookie.
  // Generate with: openssl rand -base64 48
  //   • Non-prod: >= 32 chars (so tests / dev can pin a fixed value)
  //   • Production: >= 48 chars AND >= 3 bits/char Shannon entropy
  // The length-by-environment + entropy check are enforced post-parse so
  // they can read NODE_ENV (which is itself parsed by this same schema).
  SESSION_SECRET: z.string(),
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
