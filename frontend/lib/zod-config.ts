import { z } from "zod";

/**
 * Disable Zod v4's JIT validator compiler.
 *
 * Why: our production CSP is `script-src 'nonce-X' 'strict-dynamic'` — no
 * `'unsafe-eval'`. Zod v4's JIT path probes whether `new Function()` is
 * permitted by actually calling `Function("")` inside a try/catch (see
 * `zod/src/v4/core/util.ts` — `allowsEval`). Even though Zod gracefully
 * falls back to its interpreter when the probe throws, the CALL ITSELF
 * lands in Chrome's DevTools Issues panel as a `ContentSecurityPolicy`
 * violation (`violatedDirective: "script-src"`,
 * `contentSecurityPolicyViolationType: "kEvalViolation"`). Lighthouse's
 * `inspector-issues` audit picks that up, dragging Best Practices to
 * 96/100. Verified end-to-end via CDP capture against the production
 * alias.
 *
 * `z.config({ jitless: true })` short-circuits the probe entirely (see
 * `zod/src/v4/core/util.ts:367` — early-return path) so no
 * `new Function` is ever called. Zod then uses interpreter-mode
 * validators across the board.
 *
 * Perf delta is sub-microsecond on our schema surface (model
 * allowlist, OpenAI key shape, chat-message shape, env-var shape) —
 * invisible at any traffic level we serve. The trade is "Best
 * Practices 96 → 100" in exchange for "interpreter-mode schema
 * validation," which is free for us.
 *
 * Import this module FIRST in any file that defines or imports zod
 * schemas. The config call is global + memoised by Zod, so re-imports
 * are no-ops.
 */
z.config({ jitless: true });
