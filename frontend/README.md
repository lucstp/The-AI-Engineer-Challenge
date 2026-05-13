# Frontend - Calm Chat

A polished Next.js App Router frontend for the AI Engineer Challenge backend.

## What it does

- Offers a warm, responsive chat interface with a refined empty state.
- Sends user prompts to the FastAPI backend at `POST /api/chat`.
- Shows assistant thinking state while waiting.
- Reveals assistant replies with a typewriter animation (with reduced-motion respect).
- Uses server-configured backend mode (no frontend API key handling).

## Local run

From repository root:

```bash
cd frontend
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Backend requirement

Run the FastAPI backend separately on `http://127.0.0.1:8000` so the frontend can reach:

- `POST http://127.0.0.1:8000/api/chat`

If your backend runs on a different URL, set:

```bash
NEXT_PUBLIC_BACKEND_URL=http://your-backend-host:port
```

then run `pnpm dev`.

## Notes on keys and safety

- This frontend does **not** collect, store, or send OpenAI API keys from the browser.
- The backend owns key management through its runtime environment.

## Production checks

Use this quick checklist before calling the frontend ready:

- Backend down: UI shows a clear connection error with recovery guidance.
- Slow backend: request times out with explicit timeout messaging.
- Keyboard flow: Enter sends, Shift+Enter inserts a newline, focus states remain visible.
- Motion preference: assistant typewriter and dot animations respect reduced-motion.
- Data safety: no API key input, no key persistence, and no key logging in frontend code.