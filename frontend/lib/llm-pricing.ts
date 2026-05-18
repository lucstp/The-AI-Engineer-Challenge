/**
 * LLM token cost computation for OpenTelemetry span enrichment.
 *
 * Emitted as the non-standard `llm.cost_usd` span attribute alongside
 * the OTel GenAI semantic-convention `gen_ai.usage.input_tokens` and
 * `gen_ai.usage.output_tokens`. The token attributes are the canonical,
 * vendor-neutral signal; cost is a derived convenience for at-a-glance
 * dashboard sanity checks.
 *
 * Prices are APPROXIMATE — verify against the OpenAI pricing page
 * (https://openai.com/api/pricing/) before trusting cost aggregations.
 * Update this table when pricing changes; rotation cadence is low so
 * a static table is the right shape (no env override, no remote fetch
 * adding boot-time latency or a network dependency on the chat path).
 *
 * Models not in the table return `undefined` — callers must skip
 * emitting `llm.cost_usd` rather than emit zero, which would silently
 * skew aggregate cost dashboards.
 */

export interface ModelPricing {
  /** USD per 1,000,000 input (prompt) tokens. */
  inputPer1M: number;
  /** USD per 1,000,000 output (completion) tokens. */
  outputPer1M: number;
}

/**
 * Approximate per-million-token pricing for the model dropdown allowlist.
 * Keep keys in sync with `lib/constants.ts` MODELS array.
 */
export const LLM_PRICING: Readonly<Record<string, ModelPricing>> = Object.freeze({
  "gpt-5-mini": { inputPer1M: 0.25, outputPer1M: 2.0 },
  "gpt-5": { inputPer1M: 1.25, outputPer1M: 10.0 },
  "gpt-5.5": { inputPer1M: 15.0, outputPer1M: 60.0 },
});

/**
 * Computes USD cost for a chat completion. Returns `undefined` when
 * the model is not in the pricing table — callers should omit the
 * `llm.cost_usd` attribute in that case instead of emitting zero.
 */
export function computeChatCostUsd(
  model: string,
  inputTokens: number,
  outputTokens: number
): number | undefined {
  const pricing = LLM_PRICING[model];
  if (!pricing) return undefined;
  const inputCost = (inputTokens / 1_000_000) * pricing.inputPer1M;
  const outputCost = (outputTokens / 1_000_000) * pricing.outputPer1M;
  return inputCost + outputCost;
}
