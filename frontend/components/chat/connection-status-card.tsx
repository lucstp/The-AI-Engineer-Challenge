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
 *
 * PR 14 slots a SoundToggle into the row beside the status pill. Keeping
 * the prop surface narrow now so that addition is additive, not breaking.
 */
export function ConnectionStatusCard({
  statusText,
  hasError,
  onDisconnect,
  isDisconnecting = false,
}: ConnectionStatusCardProps) {
  return (
    <header className="chat-header">
      <h1 className="m-0 font-bold text-[0.68rem] text-white/85 uppercase tracking-[0.24em] sm:text-xs">
        <span className="bg-linear-to-r from-cyan-300 via-fuchsia-400 to-violet-400 bg-clip-text text-transparent">
          Coldplay
        </span>{" "}
        Chat
      </h1>
      <div className="flex items-center gap-2">
        <div
          role="status"
          aria-live="polite"
          className="inline-flex max-w-[60vw] items-center gap-2 rounded-full border border-white/22 bg-white/6 px-2.5 py-1 font-semibold text-[0.68rem] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] sm:text-xs"
        >
          <span
            className={cn(
              "h-2 w-2 shrink-0 rounded-full",
              hasError
                ? "bg-rose-400 shadow-[0_0_6px_rgba(251,113,133,0.7)]"
                : "status-dot-live bg-emerald-300"
            )}
          />
          <span className="truncate max-[480px]:sr-only">{statusText}</span>
        </div>
        {onDisconnect ? (
          <button
            type="button"
            onClick={onDisconnect}
            disabled={isDisconnecting}
            className="inline-flex items-center rounded-full border border-white/22 bg-white/4 px-2.5 py-1 font-semibold text-[0.68rem] text-white/85 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60 sm:text-xs"
            aria-label="Disconnect verified key"
          >
            {isDisconnecting ? "Disconnecting..." : "Disconnect"}
          </button>
        ) : null}
      </div>
    </header>
  );
}
