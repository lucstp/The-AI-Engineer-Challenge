# Coldplay AI Companion — Frontend

> *"Hello! I'm your Coldplay AI companion.*
> *Ask me anything about songs, albums, lyrics, live shows, or the band's journey.*
> *I'll do my best to help you explore their universe."*

That's the first thing the chat types out, three lines, one character at a time. The rest of this README is how the experience gets there — without ever putting your OpenAI key in the browser.

A love letter to **Coldplay** wrapped in a security-hardened streaming chat. Built as the capstone of the **AI Maker Space — AI Engineering Challenge**. Non-commercial, educational fair use — the band is the subject of the project, not its sponsor.

---

## What this is

Most chat starters are 200 lines of "fetch → render." This one is closer to a small product. The chat is the obvious part — Coldplay-only Q&A, streaming token-by-chunk through a Next.js route handler that pretends OpenAI is the local printer. What's *less* obvious:

- A **glass shell** with a slow-orbiting moving border, framed by `Love is the only answer` handwritten epigraphs (one upper-left, one mid-right, hidden below `lg`)
- A **layered audio experience** — royalty-free crowd ambience kicks in on your first click; the licensed Pond5 *Aerophonia* track fades in after the welcome message types out; disconnect fades both back out in sequence
- A **cyan → violet → fuchsia** palette wrapped in `@theme` tokens, doodle hearts flanking the subtitle, a prism-line accent under the headline
- Seven **focused hooks** that own all behavior, one per concern (`useChatPersistence`, `useChatStreaming`, `useKeyLifecycle`, `useChatScroll`, `useShellBurstFlash`, `useWelcomeInjection`, `useSoundExperience`)
- A **single zod source of truth** for runtime validation at every trust boundary
- A security posture you could put in front of a code review: AES-256-GCM-sealed cookies, strict CSP with per-request nonces, sliding-window rate limit, same-origin guard, SSRF defense on the audio proxy, the full HTTP-header set

The companion only answers Coldplay questions, and it's serious about it. Off-topic prompts get politely redirected. The system prompt also enforces markdown discipline — proper nouns in **bold**, numbered lists for sequences, italics for descriptive phrases, no inline headings:

```text
You are a Coldplay-only assistant. Answer only questions about Coldplay,
including members, albums, songs, tours, timelines, and related official
context. If the user asks about non-Coldplay topics, politely refuse and
redirect to Coldplay-focused help.

Formatting rules (always follow these):
- Use markdown. Wrap ALL proper nouns in **bold**: band names (Coldplay),
  member full names (Chris Martin, Jonny Buckland, Guy Berryman,
  Will Champion), song titles, album titles, tour names, EP names,
  label names, collaborator names, and venue names.
- Use numbered lists for sequences (members, timelines, chronological items).
- Use bullet lists for related non-sequential items.
- Italicize emotional/descriptive phrases sparingly.
- Do not use headings (#) inline — flowing prose + lists.
```

---

## The stack

| Layer | What |
|---|---|
| Framework | **Next.js 16** (App Router) on Node runtime |
| Styling | **Tailwind v4** with `@theme` palette tokens + glass primitives in `globals.css` |
| Components | **shadcn/ui** primitives + custom `MovingBorder` for the animated shell perimeter |
| Markdown | **react-markdown** + **remark-gfm** for assistant message rendering |
| Validation | **zod** at every trust boundary |
| Lint / format | **biome v2** (one tool, runs in milliseconds) |
| Server runtime | Node 22 |
| Edge | **Next.js 16 `proxy.ts`** (replaces deprecated `middleware.ts`) for per-request CSP nonce |
| Rate limit | **@upstash/ratelimit** + **@upstash/redis** with in-memory fallback |
| Tests | **Playwright** (e2e, port 3010, prod build) + **vitest** (unit) |
| Hosting | Vercel (region `iad1`, function caps tuned per route) |
| Audio CDN | Vercel Blob (the licensed track stays there — NEVER in git) |

---

## Run it locally

You'll need `pnpm@10.30.1` (use `corepack enable` if you don't have it).

```bash
cd frontend
pnpm install
```

Make a `.env.local` with at minimum the session secret. The app refuses to boot without it:

```bash
printf 'SESSION_SECRET=%s\n' "$(openssl rand -base64 48)" > .env.local
```

Then either dev or prod:

```bash
pnpm dev                       # Next dev server on http://localhost:3000
# or
pnpm build && pnpm start       # production build, also on :3000
```

Paste any plausible `sk-...` key, click Verify, and you're chatting.

Want music locally? `BLOB_AUDIO_AEROPHONIA_URL` is optional — without it, the audio route falls back to looking for `private/audio/aerophonia-full.mp3` (gitignored — you'd drop your own license-cleared file there for testing). On Vercel production, the env var lights up the Vercel Blob path.

---

## Architecture at a glance

### Request flow (chat)

```
┌──────────┐   POST /api/chat        ┌──────────────┐   POST  ┌─────────┐
│ Browser  │ ────────────────────▶   │  Next route  │ ──────▶ │ OpenAI  │
│ (chat-   │   (sealed cookie)       │ (Node, iad1) │ (Bearer │  /v1/   │
│  shell)  │ ◀─── plain-text ──────  │  serverless  │  unseal)│         │
└──────────┘     UTF-8 chunks        └──────────────┘ ◀── SSE ┘
       ▲                                    │
       │ streamChatMessage                  │ Same-origin guard
       │ (onChunk callback)                 │ Rate limit (Upstash)
       │                                    │ Content-Length cap (8KB)
       │                                    │ Unseal AES-256-GCM cookie
       │                                    │ Strip SSE envelope
       │                                    ▼
       │                            plain-text content deltas
       └──────────────────────────── on the wire to the client
```

### Audio flow (gesture → music)

```
First user gesture (click "Verify")
      │
      ▼
LockedKeyCard.onBeforeSubmit
      │
      ▼
useSoundExperience.startCrowd()       ┐
      │                               │  Public asset
      ▼                               │  /public/audio/crowd.mp3
AudioOrchestrator (crowd.play, fade) ─┘

      ... welcome typewriter completes ...

ChatPanel.onAnimationDone (first assistant msg)
      │
      ▼
useSoundExperience.startMusic()
      │
      ▼
fetch /api/audio/aerophonia
      ├── BLOB_AUDIO_AEROPHONIA_URL set?
      │   └── proxy-stream from Vercel Blob (host-allowlisted)
      └── else fall back to private/audio/aerophonia-full.mp3 (dev only)

      ... user clicks Disconnect ...

useKeyLifecycle.disconnect → sound.stopAll()
      ├── fade music out
      ├── 1.5s pause
      └── fade crowd out
```

### Security layers (execution order on `/api/chat`)

```
1. Same-origin guard       ──► reject 403 if Origin missing or mismatched
2. Per-IP rate limit       ──► reject 429 if > 20 req/min sliding window
3. Content-Length cap      ──► reject 413 if body > 8KB
4. zod schema validation   ──► reject 400 if message empty / > 4000 chars
5. Unseal cookie (AES-GCM) ──► reject 401 if absent, tampered, or wrong key
6. Plausibility check      ──► reject 401 if decrypted value not "sk-..." shape
7. Forward to OpenAI       ──► (only now do we touch the paid path)
```

---

## Security posture

Plain English. Each link points at the code.

- **Your OpenAI key never lives in the browser.** Verify happens server-side via a Next.js Server Action ([`app/actions.ts`](app/actions.ts)). On success, the key is **AES-256-GCM-sealed** ([`lib/session-crypto.ts`](lib/session-crypto.ts)) with the server-only `SESSION_SECRET` and stored as an `httpOnly`, `sameSite: strict` cookie with a 24h TTL. Even if a browser extension dumps the entire cookie jar, all it gets is an opaque blob.
- **`/api/chat` is rate-limited** ([`lib/rate-limit.ts`](lib/rate-limit.ts)) at 20 req/min/IP sliding window. Production uses Upstash Redis (state shared across function instances). Dev uses an in-memory `Map`. A loud `console.warn` fires in production if the Upstash creds are missing.
- **Same-origin guard on `/api/chat`** ([`app/api/chat/route.ts`](app/api/chat/route.ts)) — Server Actions get CSRF protection from Next.js for free; route handlers don't. We close the gap.
- **CSP with per-request nonces** ([`proxy.ts`](proxy.ts)) + static security headers in [`next.config.ts`](next.config.ts) (HSTS preload, X-Frame-Options DENY, Permissions-Policy full-deny, COOP, CORP, the lot). Violations land at [`/api/csp-report`](app/api/csp-report/route.ts) and get structured-logged.
- **`SESSION_SECRET` boot-time strength gate** ([`lib/env.ts`](lib/env.ts)): production requires ≥ 48 chars AND ≥ 3 bits/char Shannon entropy. Hand-typed `password123` patterns get rejected before the first request can land.
- **Audio-route SSRF defense** ([`app/api/audio/aerophonia/route.ts`](app/api/audio/aerophonia/route.ts)): host-allowlisted to `.public.blob.vercel-storage.com`. A tampered `BLOB_AUDIO_AEROPHONIA_URL` can't redirect the fetch elsewhere.

---

## Deploy to Vercel

1. Import the repo
2. **Root Directory** → `frontend`
3. **Framework Preset** auto-detects as Next.js (verify)
4. **Production Branch** → `main`
5. **Environment Variables** (set on both Production AND Preview):

| Var | Required? | Value |
|---|---|---|
| `SESSION_SECRET` | **Yes** | `openssl rand -base64 48` (NEW value, distinct from local) |
| `OPENAI_MODEL` | No (defaults to `gpt-5`) | **`gpt-4.1-mini`** for the course-canonical configuration (see [Things that look weird on purpose](#things-that-look-weird-on-purpose) for the trade-off vs the `gpt-5` default) |
| `OPENAI_MAX_COMPLETION_TOKENS` | No (defaults to `1500`) | `1500` is fine for `gpt-4.1-mini` (no reasoning overhead). Bump to `4000` if using `gpt-5` so reasoning has room without exhausting the budget mid-answer. |
| `BLOB_AUDIO_AEROPHONIA_URL` | No | Full Vercel Blob URL of your licensed audio |
| `KV_REST_API_URL` | No | Auto-set when you connect Upstash from **Storage → Marketplace** with no custom prefix |
| `KV_REST_API_TOKEN` | No | Auto-set by the same Upstash integration |

> **Authoritative schema:** [`lib/env.ts`](lib/env.ts) — boot-time zod validation, fails loud at startup rather than silently at first request.

6. Click Deploy

Region pin (`iad1`) and per-function memory / duration live in [`vercel.json`](vercel.json). Keep `/api/chat` co-located with your Upstash Redis region for sub-100ms rate-limit checks.

---

## Tests

```bash
pnpm test:run                  # vitest, single-pass
pnpm test                      # vitest, watch mode
pnpm test:e2e                  # playwright on port 3010 against a prod build
```

The e2e tests build into `.next-test/` (separate from your `.next/`) and run on port **3010**, so you can keep `pnpm dev` on 3000 while tests execute. `tests/global-setup.ts` pins a `TEST_SESSION_SECRET` so boot-time env validation passes without reusing your real production secret.

Two opt-in visual configs:

```bash
pnpm exec playwright test --config=walkthrough.config.ts     # locked → verified → disconnect screenshots
pnpm exec playwright test --config=responsive.config.ts      # 375 / 414 / 768 / 1024 / 1440 audit
```

---

## The audio: what's free, what isn't

Two tracks, two stories.

| Track | Where it lives | What's allowed |
|---|---|---|
| `public/audio/crowd.mp3` | In the repo | Royalty-free stadium ambience. Free to ship, free to fork. |
| Licensed Pond5 *"Aerophonia"* by TangerineMedia | **Vercel Blob only — NEVER in git** | Paid IP, used under Pond5 license. Lives behind `BLOB_AUDIO_AEROPHONIA_URL`. `private/` is gitignored. |

If you fork this repo, the music track will not stream in your deployment until you upload your own license-cleared track to Vercel Blob and point the env var at it. The crowd track works out of the box.

---

## Visual language (the parts you can see)

The shell is one card. It glows. It has personality.

- **`@theme` palette tokens** in `globals.css` expose the Coldplay-inspired gradient (cyan-300 → violet-400 → fuchsia-400) as Tailwind utilities — the same three stops drive the headline `Coldplay` wordmark, the locked-state H2, and the speaker pill
- **`MovingBorder`** ([`components/ui/moving-border.tsx`](components/ui/moving-border.tsx)) — a 2.5px-wide stroke that orbits the chat shell perimeter on an 11s loop. SVG mask, GPU-friendly, respects `prefers-reduced-motion`
- **`AuroraBackground`** + the two `LoveIsTheOnlyAnswer` handwritten epigraphs frame the chat shell diagonally at `lg+` breakpoints
- **`DoodleHearts`** flank the hero subtitle (yellow on the left, orange on the right, slightly rotated for hand-drawn feel)
- **`prism-line`** — a thin chromatic-aberration hairline accent under the headline, defined as a `@theme` glass primitive
- **`shell-burst`** — a 900ms glow flash on lock-state flip (verify success / disconnect), driven by `useShellBurstFlash`
- **Welcome typewriter** — three lines, two markdown hard-breaks, ~2.2s reveal, owned by `useWelcomeInjection` with a synchronous ref-latch that survives React 18 StrictMode's dev double-invoke

---

## Things that look weird on purpose

- **`<meta name="robots" content="noindex,nofollow">`** in [`app/layout.tsx`](app/layout.tsx) + `Disallow: /` in [`public/robots.txt`](public/robots.txt). Intentional. Non-commercial educational use of Coldplay brand IP under fair use; allowing search-engine indexing would risk brand-confusion concerns. Lighthouse drops SEO to ~63 because of this — by design, not a regression.
- **The in-memory rate limiter falls back from Upstash when env vars are missing**, with a loud production warning. Single-instance hobby deployments are fine; autoscaled serverless absolutely is not. The warning makes the gap visible in logs.
- **Audio starts on the *first* user gesture** because browsers refuse `play()` outside one. The cyan-glow "Turn on sound for the full experience" pill on the locked card is the contract: it warns sound is coming; clicking Verify is the gesture that unlocks the crowd track.
- **`gpt-5` is the code default model** because that matches the sibling FastAPI backend ([`api/index.py:37`](../api/index.py)). But `gpt-5` is a reasoning model — it runs silent chain-of-thought before emitting any visible tokens (5-30s wait before content streams), and if `OPENAI_MAX_COMPLETION_TOKENS` is too low the reasoning eats the entire budget and the user gets an empty response. **The course-canonical model is `gpt-4.1-mini`** — that's what the [AI Maker Space — AI Engineering Challenge](https://github.com/AI-Maker-Space/The-AI-Engineer-Challenge) course teaches ("*Accessing 'gpt-4.1-mini' (ChatGPT) like a developer*"). For the course submission deployment, set `OPENAI_MODEL=gpt-4.1-mini` in Vercel — fast (TTFT <1s, ~3-5s end-to-end), no reasoning overhead, and the `OPENAI_MAX_COMPLETION_TOKENS` default of `1500` is plenty. The empty-response incident this surfaced is documented in [`lib/env.ts`](lib/env.ts) lines 43-49.
- **The disclaimer paragraph at the bottom of the page is not boilerplate.** It exists because this project uses the *Coldplay* name nominatively — describing the subject of the chat, not implying any affiliation. The same goes for the `Audio Credits` block listing Pond5 / TangerineMedia properly.

---

## What I'd build next

Honest list:

- Token-by-token typewriter rendering during the stream (chunks currently arrive at chunk-boundary; smooth but not glyph-precise)
- Multi-turn conversation memory beyond the current session (disconnect = wipe today, by design)
- An admin route to surface the structured CSP-violation log without grepping Vercel function logs
- A `useReducer`-backed `useChatStreaming` so the in-flight controller, error, and stopped flags stop drifting

---

## File map (start here)

```
frontend/
├── app/
│   ├── layout.tsx              # metadata baseline, skip-link, robots:noindex
│   ├── page.tsx                # server-side unseal + initial verified state
│   ├── actions.ts              # verify / clear / has-verified server actions
│   ├── error.tsx               # route-level error boundary
│   ├── global-error.tsx        # root-level error boundary
│   └── api/
│       ├── chat/route.ts       # streaming OpenAI proxy (all the guards)
│       ├── csp-report/route.ts # CSP violation sink
│       └── audio/aerophonia/   # Vercel Blob proxy + local fallback
├── components/
│   ├── chat/                   # the decomposed chat surface
│   ├── decoration/             # aurora, doodle hearts, "Love is the only answer"
│   ├── layout/                 # hero, disclaimer footer
│   ├── sound/                  # speaker toggle pill
│   └── ui/                     # shadcn primitives + moving-border
├── lib/
│   ├── schemas.ts              # zod single source of truth
│   ├── session-crypto.ts       # AES-256-GCM seal/unseal
│   ├── rate-limit.ts           # Upstash + in-memory adapter
│   ├── env.ts                  # boot-time env validation
│   ├── audio/                  # orchestrator + track urls
│   └── hooks/                  # the seven feature hooks
├── proxy.ts                    # per-request CSP nonce (Next 16 file convention)
├── next.config.ts              # static security headers
├── vercel.json                 # region + function caps
└── tests/                      # vitest + playwright specs
```

---

Built with `Coldplay` on loop, of course. Capstone of the **AI Maker Space — AI Engineering Challenge** course.

*Love is the only answer.*
