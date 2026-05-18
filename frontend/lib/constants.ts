/**
 * Single source of truth for the model dropdown + server-side allowlist.
 *
 * Each model carries its own `maxCompletionTokens` because reasoning
 * models (gpt-5 family) burn hundreds of tokens on silent chain-of-
 * thought before emitting a visible delta — a too-low cap exhausts the
 * budget on reasoning → empty stream → user sees "assistant returned
 * an empty response." See `lib/env.ts:42-50` for the original rationale.
 *
 * Adding/removing a model is a single-source change here — the zod
 * allowlist in `lib/schemas.ts`, the dropdown UI, and the per-model
 * token cap on `/api/chat` all derive from this array.
 */
export const MODELS = [
  {
    id: "gpt-5-mini",
    name: "Fast",
    description: "Quick responses for everyday tasks",
    maxCompletionTokens: 4000,
  },
  {
    id: "gpt-5",
    name: "Balanced",
    description: "Best mix of speed, intelligence, and accuracy",
    maxCompletionTokens: 4000,
  },
  {
    id: "gpt-5.5",
    name: "Advanced",
    description: "Strongest reasoning for coding, research, and complex tasks",
    maxCompletionTokens: 4000,
  },
] as const;

export type ModelOption = (typeof MODELS)[number];
export type ModelId = ModelOption["id"];

export const DEFAULT_MODEL: ModelId = MODELS[0].id;

/** Tuple form required by `z.enum()` at the schema boundary. */
export const MODEL_IDS = MODELS.map((m) => m.id) as [ModelId, ...ModelId[]];

/** Runtime type guard for hydrating localStorage / parsing untrusted input. */
export function isModelId(value: unknown): value is ModelId {
  return typeof value === "string" && MODELS.some((m) => m.id === value);
}
