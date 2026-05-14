import { z } from "zod";

/**
 * Single source of truth for all runtime validation at trust boundaries:
 *  - Server actions (`app/actions.ts`)
 *  - API route handlers (`app/api/chat/route.ts`)
 *  - Client fetch responses (`lib/chat-client.ts`)
 *  - sessionStorage hydration (`components/chat-shell.tsx`)
 *
 * Static types are derived via `z.infer<>` so editing a schema updates all
 * call-site types simultaneously — no parallel type/schema drift.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Domain — chat messages
// ─────────────────────────────────────────────────────────────────────────────

export const roleSchema = z.enum(["user", "assistant"]);

export const chatMessageSchema = z.object({
  id: z.string().min(1),
  role: roleSchema,
  content: z.string(),
  createdAt: z.number().finite(),
  animate: z.boolean().optional(),
  typingMs: z.number().finite().positive().optional(),
});

export type Role = z.infer<typeof roleSchema>;
export type ChatMessage = z.infer<typeof chatMessageSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Boundary — POST /api/chat request body
// ─────────────────────────────────────────────────────────────────────────────

export const chatRequestSchema = z.object({
  message: z.string().trim().min(1, "Message cannot be empty.").max(4000, "Message is too long."),
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Boundary — OpenAI key verification input
// ─────────────────────────────────────────────────────────────────────────────

const OPENAI_KEY_MIN_LENGTH = 24;
const OPENAI_KEY_MAX_LENGTH = 256;

export const verifyKeyInputSchema = z
  .string()
  .trim()
  .min(OPENAI_KEY_MIN_LENGTH)
  .max(OPENAI_KEY_MAX_LENGTH)
  .refine((value) => value.startsWith("sk-"), {
    message: "OpenAI keys must start with 'sk-'.",
  });

/** Pure predicate used in non-throwing checks (cookie hydration). */
export function isPlausibleOpenAiKey(value: string): boolean {
  return verifyKeyInputSchema.safeParse(value).success;
}

// ─────────────────────────────────────────────────────────────────────────────
// Boundary — sessionStorage persisted chat UI state
// ─────────────────────────────────────────────────────────────────────────────

export const persistedChatUiStateSchema = z.object({
  messages: z.array(chatMessageSchema),
  inputValue: z.string(),
});

export type PersistedChatUiState = z.infer<typeof persistedChatUiStateSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Boundary — OpenAI SSE chunk envelope
// (only the fields we depend on; OpenAI may add more without breaking us)
// ─────────────────────────────────────────────────────────────────────────────

export const openAiStreamChunkSchema = z.object({
  choices: z
    .array(
      z.object({
        delta: z
          .object({
            content: z.string().optional(),
          })
          .passthrough(),
      })
    )
    .min(1),
});

export type OpenAiStreamChunk = z.infer<typeof openAiStreamChunkSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Boundary — OpenAI error response envelope
// ─────────────────────────────────────────────────────────────────────────────

export const openAiErrorResponseSchema = z.object({
  error: z.object({
    message: z.string().min(1),
  }),
});

// ─────────────────────────────────────────────────────────────────────────────
// Boundary — client fetch error response (from /api/chat)
// ─────────────────────────────────────────────────────────────────────────────

export const chatErrorResponseSchema = z.object({
  detail: z.string().min(1),
});
