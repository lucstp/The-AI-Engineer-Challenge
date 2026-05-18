import { SoundToggle } from "@/components/sound/sound-toggle";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface ConnectionStatusCardProps {
  statusText: string;
  hasError: boolean;
  /**
   * Pre-validation state. Drives the status dot to red — locked means the
   * chat is not yet usable (no verified key), semantically equivalent to
   * "not ready." Green is reserved for verified + healthy.
   */
  isLocked: boolean;
  onDisconnect?: () => void;
  isDisconnecting?: boolean;
  /**
   * Sound preference + toggle. Always present (locked + verified) so users
   * can pre-mute before clicking Verify if they don't want the crowd
   * ambience to start.
   */
  isSoundEnabled: boolean;
  onToggleSound: () => void;
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
 *   - SoundToggle lives in this row so the user can mute/unmute at any
 *     point in the session without leaving the chat surface.
 */
export function ConnectionStatusCard({
  statusText,
  hasError,
  isLocked,
  onDisconnect,
  isDisconnecting = false,
  isSoundEnabled,
  onToggleSound,
}: ConnectionStatusCardProps) {
  // Red covers both not-ready states (locked, pre-validation) AND error
  // states (invalid key, OpenAI failure). Green is reserved for verified +
  // healthy — the only state where the chat is actually usable.
  const isNotReady = hasError || isLocked;
  return (
    <header className="chat-header">
      {/* Wordmark — both halves rendered in solid colors (not a gradient on
          transparent text, which had poor contrast against the new translucent
          glass and was hard to read). Coldplay stays cyan-tinted for brand
          recognition; Chat is white for legibility. drop-shadow on the parent
          makes the wordmark readable on every aurora band the glass shows. */}
      <h1 className="m-0 font-bold text-[0.68rem] text-white uppercase tracking-[0.24em] [text-shadow:0_1px_2px_rgba(2,6,23,0.65)] sm:text-xs">
        <span className="text-fuchsia-300">Coldplay</span> <span className="text-white">Chat</span>
      </h1>
      <div className="flex items-center gap-2">
        <SoundToggle isEnabled={isSoundEnabled} onToggle={onToggleSound} />
        {/* All three header controls now share the SAME explicit height
            (h-7 / sm:h-8) so the row reads as a single visual unit. Before:
            the SoundToggle (h-7) was visibly taller than the status pill +
            Disconnect button (content-driven ~h-5), creating a mismatched
            row. */}
        <div
          role="status"
          aria-live="polite"
          className="inline-flex h-7 max-w-[60vw] items-center gap-2 rounded-full border border-white/22 bg-white/6 px-2.5 font-semibold text-[0.68rem] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] sm:h-8 sm:text-xs"
        >
          <span
            className={cn(
              "h-2 w-2 shrink-0 rounded-full",
              isNotReady
                ? "bg-rose-400 shadow-[0_0_6px_rgba(251,113,133,0.7)]"
                : "status-dot-live bg-emerald-300"
            )}
          />
          <span className="truncate max-[480px]:sr-only">{statusText}</span>
        </div>
        {onDisconnect ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onDisconnect}
                disabled={isDisconnecting}
                className="inline-flex h-7 items-center rounded-full border border-white/22 bg-white/4 px-2.5 font-semibold text-[0.68rem] text-white/85 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60 sm:h-8 sm:text-xs"
                aria-label="Disconnect verified key"
              >
                {isDisconnecting ? "Disconnecting..." : "Disconnect"}
              </button>
            </TooltipTrigger>
            <TooltipContent>Clear API key and end session</TooltipContent>
          </Tooltip>
        ) : null}
      </div>
    </header>
  );
}
