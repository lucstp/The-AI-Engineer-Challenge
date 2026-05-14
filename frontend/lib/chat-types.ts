/**
 * Domain types are inferred from zod schemas (single source of truth).
 * This file exists for backwards-compatible imports — new code should
 * import directly from `@/lib/schemas`.
 */
export type { ChatMessage, ChatRequest, PersistedChatUiState, Role } from "@/lib/schemas";
