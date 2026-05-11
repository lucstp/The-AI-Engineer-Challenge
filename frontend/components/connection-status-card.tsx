import { cn } from "@/lib/utils";

interface ConnectionStatusCardProps {
  statusText: string;
  hasError: boolean;
  onDisconnect?: () => void;
  isDisconnecting?: boolean;
}

/**
 * Slim top-of-shell status bar.
 *
 * Design rationale (FAANG hero-first hierarchy):
 *   - The product value is the conversation, not the brand chrome.
 *   - A small wordmark + status pill is enough orientation for the user.
 *   - The big H1 + subtitle pattern was over-claiming vertical space and
 *     visually competing with the chat hero / empty-state prompts.
 *   - Status pill keeps live, accessible feedback for connection / errors.
 *   - Disconnect is co-located here (its natural home) so verified users
 *     always have a clear sign-out path without a dedicated panel.
 */
export function ConnectionStatusCard({
  statusText,
  hasError,
  onDisconnect,
  isDisconnecting = false
}: ConnectionStatusCardProps) {
  return (
    <header className="flex items-center justify-between gap-3">
      {/* H1 kept for a11y / SEO, visually compact so it doesn't compete with the chat hero. */}
      <h1 className="m-0 text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-white/70 sm:text-xs">
        Coldplay Chat
      </h1>
      <div className="flex items-center gap-2">
        <div
          role="status"
          aria-live="polite"
          className="inline-flex max-w-[60vw] items-center gap-2 rounded-full border border-white/22 bg-white/[0.06] px-2.5 py-1 text-[0.68rem] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] sm:text-xs"
        >
          <span
            className={cn(
              "h-2 w-2 shrink-0 rounded-full",
              hasError
                ? "bg-rose-400 shadow-[0_0_6px_rgba(251,113,133,0.7)]"
                : "bg-emerald-300 shadow-[0_0_6px_rgba(110,231,183,0.7)]"
            )}
          />
          <span className="truncate">{statusText}</span>
        </div>
        {onDisconnect ? (
          <button
            type="button"
            onClick={onDisconnect}
            disabled={isDisconnecting}
            className="inline-flex items-center rounded-full border border-white/22 bg-white/[0.04] px-2.5 py-1 text-[0.68rem] font-semibold text-white/85 transition hover:bg-white/[0.10] disabled:cursor-not-allowed disabled:opacity-60 sm:text-xs"
            aria-label="Disconnect verified key"
          >
            {isDisconnecting ? "Disconnecting..." : "Disconnect"}
          </button>
        ) : null}
      </div>
    </header>
  );
}
