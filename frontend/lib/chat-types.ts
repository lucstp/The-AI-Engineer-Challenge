/**
 * Domain types are inferred from zod schemas + literal-typed constants
 * (single source of truth). This file exists for backwards-compatible
 * imports — new code should import directly from `@/lib/schemas` or
 * `@/lib/constants`.
 */
export type { ModelId, ModelOption } from "@/lib/constants";
export type { ChatMessage, ChatRequest, PersistedChatUiState, Role } from "@/lib/schemas";
