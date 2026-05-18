"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Root-level error boundary. Triggered when the root layout itself throws.
 * Must include its own <html> and <body> since the layout is unavailable.
 *
 * Capture-to-Sentry fires in `useEffect` (not at render) because
 * `Sentry.captureException` queues a network request; firing it during
 * render risks a render-loop if Sentry itself throws synchronously.
 * The dependency on `error` means a fresh error after `reset()` re-fires
 * capture, while a remount with the same error object does not double-
 * report.
 */
export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0f3260",
          color: "#ffffff",
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          padding: "2rem",
        }}
      >
        <div style={{ maxWidth: "520px", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.75rem", margin: "0 0 1rem" }}>Application crashed</h1>
          <p style={{ fontSize: "0.95rem", lineHeight: 1.6, margin: "0 0 1.5rem", opacity: 0.85 }}>
            The Coldplay companion couldn&apos;t recover from a root-level error. Reloading the page
            is the safest next step.
          </p>
          {error.digest ? (
            <p style={{ fontFamily: "monospace", fontSize: "0.75rem", opacity: 0.55 }}>
              request id: {error.digest}
            </p>
          ) : null}
          <button
            type="button"
            onClick={reset}
            style={{
              padding: "0.6rem 1.4rem",
              borderRadius: "9999px",
              border: "1px solid rgba(255,255,255,0.3)",
              background: "rgba(255,255,255,0.1)",
              color: "#ffffff",
              fontSize: "1rem",
              cursor: "pointer",
            }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
