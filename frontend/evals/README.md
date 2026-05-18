# Promptfoo evaluation suite

AI behavior regression tests for the Coldplay AI Companion. Verifies what the TypeScript test layer cannot — that the **model actually obeys the system prompt** across every shipping model tier.

## What's tested

| Category | Cases | What it asserts |
|---|---|---|
| **A. On-topic accuracy** | 5 | Factual Coldplay answers · markdown bold on proper nouns · numbered lists for sequences |
| **B. Off-topic refusal** | 4 | Python / math / recipes / personal advice all get redirected to Coldplay |
| **C. Prompt-injection resistance** | 3 | Instruction-override · role-override · system-prompt leak attempts all rejected |
| **D. Markdown formatting depth** | 2 | Bullet lists for non-sequential items · no inline headings |
| **E. Tone (LLM-as-judge)** | 1 | Calm + supportive response on emotional prompts (no refusal); song titles bolded |

Each test runs against **all three production model tiers** — `gpt-5-mini` (Fast), `gpt-5` (Balanced), `gpt-5.5` (Advanced) — so the model-comparison view surfaces quality deltas between the dropdown options.

## Run locally

```bash
cd frontend
export OPENAI_API_KEY=sk-...
pnpm eval            # runs the full suite
pnpm eval:view       # opens local web UI at http://localhost:15500
```

Results land in `frontend/.promptfoo/` (gitignored). Promptfoo caches by default — re-running unchanged tests is free.

## Run in CI

`.github/workflows/evals.yml` triggers on:

- PRs that touch `app/api/chat/route.ts`, `lib/system-prompt.ts`, `lib/constants.ts`, or `evals/**`
- Manual `workflow_dispatch` from the Actions tab

The workflow uploads the eval JSON as a build artifact so anyone reviewing the PR can download the side-by-side model-comparison view locally.

## Cost discipline

- ~25 cases × 3 models ≈ **75 OpenAI calls per full run**
- LLM-as-judge calls use `gpt-5-mini` as the grader (cheapest)
- Promptfoo caches across runs — only NEW or CHANGED tests re-invoke OpenAI
- CI runs only on prompt-relevant PRs (not every PR)

## Adding a test

Edit `evals/promptfoo.config.ts`, add a new entry under `tests:`:

```ts
{
  description: "X. What it proves",
  vars: { user_message: "..." },
  assert: [
    { type: "contains", value: "..." },
    { type: "regex", value: "\\*\\*Coldplay\\*\\*" },
    { type: "not-icontains", value: "..." },
    { type: "llm-rubric", value: "..." },
  ],
}
```

Assertion types reference: <https://www.promptfoo.dev/docs/configuration/expected-outputs/>

## Why this exists

Normal tests verify code. Promptfoo verifies **AI behavior**. For an LLM app, both are required for FAANG-grade regression coverage — a code-clean PR that silently degrades the system prompt's scope-lock or markdown formatting would otherwise ship undetected.

The single source of truth for the system prompt is `lib/system-prompt.ts`, imported by both the route handler and this eval config. The prompt cannot drift between production and the regression suite.
