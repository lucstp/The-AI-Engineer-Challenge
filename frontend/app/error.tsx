"use client";

import { useEffect } from "react";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Route-level error boundary. Catches errors thrown by children
 * (e.g. <ChatShell>) and renders a calm fallback matching the
 * chat-shell aesthetic. `reset()` re-mounts the route.
 */
export default function RouteError({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Log only structured, non-sensitive fields. The raw error object
    // can carry user input or internal state — neither belongs in
    // wherever console.error gets shipped (Vercel logs, Sentry, etc.).
    // Stack traces stay locally in the browser via React's own dev tools.
    console.error("[/route-error]", {
      digest: error.digest ?? null,
      name: error.name,
    });
  }, [error]);

  return (
    <main className="relative isolate flex min-h-svh items-center justify-center px-4 py-8">
      <section
        role="alert"
        aria-live="assertive"
        className="chat-shell-glass mx-auto flex w-full max-w-[520px] flex-col items-center gap-4 rounded-3xl p-8 text-center text-white"
      >
        <h1 className="m-0 bg-linear-to-r from-cyan-300 via-fuchsia-400 to-violet-400 bg-clip-text font-bold text-2xl text-transparent">
          Something went off-key
        </h1>
        <p className="m-0 max-w-[40ch] text-sm text-white/85 leading-relaxed sm:text-base">
          The Coldplay companion hit an unexpected note. We&apos;ve logged it. You can try
          recovering this view without losing your conversation.
        </p>
        {error.digest ? (
          <p className="m-0 font-mono text-white/55 text-xs">request id: {error.digest}</p>
        ) : null}
        <button
          type="button"
          onClick={reset}
          className="aurora-button rounded-full px-6 py-2 font-semibold text-base"
        >
          Try again
        </button>
      </section>
    </main>
  );
}
