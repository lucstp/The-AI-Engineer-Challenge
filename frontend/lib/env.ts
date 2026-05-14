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
 *   serverEnv.OPENAI_MODEL   // string, validated
 *
 * Future PRs extend this schema as new env vars arrive:
 *   • PR 7  → SESSION_SECRET (AES-256-GCM cookie seal)
 *   • PR 8  → KV_REST_API_URL + KV_REST_API_TOKEN (Upstash rate limit)
 *   • PR 14 → BLOB_AUDIO_AEROPHONIA_URL (Vercel Blob audio source)
 */

const serverEnvSchema = z.object({
  OPENAI_MODEL: z.string().trim().min(1).default("gpt-5"),
  OPENAI_MAX_COMPLETION_TOKENS: z.coerce.number().int().positive().default(280),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
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
});
