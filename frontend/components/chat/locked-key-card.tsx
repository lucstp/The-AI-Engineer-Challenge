"use client";

import { Volume2 } from "lucide-react";
import type { FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type KeyFeedbackTone = "success" | "error" | "info";

interface LockedKeyCardProps {
  apiKeyInput: string;
  onApiKeyInputChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  /**
   * Side-effect fired in the same user-gesture frame as the submit, BEFORE
   * the verify network call. Used to unlock the browser audio context so
   * the crowd ambience can begin playing.
   */
  onBeforeSubmit?: () => void;
  isVerifyingKey: boolean;
  isApiKeyVerified: boolean;
  keyFeedback: string | null;
  keyFeedbackTone: KeyFeedbackTone | null;
  isSwappingPanel: boolean;
  /**
   * True only while this card is freshly mounted as the result of a
   * locked ↔ verified TRANSITION (verify rejection, disconnect, etc.).
   * False on initial paint (cold page load / refresh) so the card
   * appears static — no entry animation, no opacity-0→1 flash. Owned
   * by ChatShell via a set-state-during-render gate; cleared 260ms
   * after the transition completes.
   */
  isEntering: boolean;
}

/**
 * Compact "unlock the chat" card shown when the OpenAI key has not yet been
 * verified. Lives inside the chat shell and centers itself vertically within
 * the available space. The shell wrapper transitions height between this
 * compact state and the full-chat state on a soft spring curve.
 */
export function LockedKeyCard({
  apiKeyInput,
  onApiKeyInputChange,
  onSubmit,
  onBeforeSubmit,
  isVerifyingKey,
  isApiKeyVerified,
  keyFeedback,
  keyFeedbackTone,
  isSwappingPanel,
  isEntering,
}: LockedKeyCardProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    // Fire the audio kick-off synchronously inside the user-gesture frame
    // BEFORE forwarding to the verify handler — browsers require play()
    // to be called from a gesture, and any async work in onSubmit would
    // break that contract.
    onBeforeSubmit?.();
    onSubmit(event);
  }

  return (
    <section
      aria-label="OpenAI key verification"
      className={cn(
        "flex flex-col items-center gap-3 px-2 py-2 text-center sm:gap-4 sm:py-4",
        isSwappingPanel ? "panel-exit" : isEntering ? "panel-enter" : null
      )}
    >
      <h2 className="m-0 bg-linear-to-r from-cyan-300 via-fuchsia-400 to-violet-400 bg-clip-text font-bold text-transparent text-xl leading-tight sm:text-2xl">
        Unlock your Coldplay companion
      </h2>
      <p className="m-0 max-w-[44ch] text-sm text-white/90 leading-relaxed [text-shadow:0_1px_2px_rgba(0,0,0,0.4)] sm:text-base">
        Enter your OpenAI key to begin.
      </p>
      {/* "Turn on sound" pill — cyan glow + bordered pill so it scans
          immediately, while the aurora-pill / rounded-full vocabulary keeps
          it in the existing chrome family. Lives ABOVE the form so the
          user sees it before clicking Verify. */}
      <p className="mt-2 mb-2 inline-flex items-center gap-2 rounded-full border border-cyan-300/35 bg-cyan-300/8 px-4 py-1.5 font-medium text-yellow-200 text-sm shadow-[0_0_20px_rgba(125,249,255,0.18)] [text-shadow:0_1px_2px_rgba(0,0,0,0.45)] sm:mt-3 sm:mb-3 sm:gap-2.5 sm:px-5 sm:py-2 sm:text-base">
        <Volume2 aria-hidden className="h-4 w-4 shrink-0 sm:h-[18px] sm:w-[18px]" />
        <span className="italic">Turn on your device sound for the full experience.</span>
      </p>
      <form
        onSubmit={handleSubmit}
        className="grid w-full max-w-[560px] grid-cols-1 gap-2.5 sm:grid-cols-[1fr_auto] sm:gap-3"
      >
        <Label htmlFor="openai-key" className="sr-only">
          OpenAI API key
        </Label>
        <div className="locked-input-ring">
          <Input
            id="openai-key"
            type="password"
            autoComplete="off"
            className="h-12 text-base focus-visible:border-white/30 focus-visible:ring-0 focus-visible:ring-offset-0"
            value={apiKeyInput}
            onChange={(event) => onApiKeyInputChange(event.target.value)}
            placeholder="sk-..."
            aria-describedby="key-feedback"
          />
        </div>
        {/* Wrapped in the same `locked-input-ring` as the Input so the
            button gets an identical animated prism gradient border —
            colors, height, and visual family match the input on its left.
            The Button interior is darker translucent glass with white
            text for readability against the page. */}
        <div className="locked-input-ring">
          <Button
            type="submit"
            disabled={isVerifyingKey || apiKeyInput.trim().length === 0}
            className="locked-verify-btn h-12 border-0 bg-slate-950/55 px-7 font-semibold text-base text-white shadow-none hover:bg-slate-950/70 hover:text-white disabled:opacity-65"
          >
            {isVerifyingKey ? "Verifying..." : "Verify key"}
          </Button>
        </div>
      </form>
      {keyFeedback ? (
        <p
          id="key-feedback"
          role={isApiKeyVerified ? "status" : "alert"}
          className={cn(
            "m-0 font-semibold text-sm",
            keyFeedbackTone === "success"
              ? "text-emerald-200"
              : keyFeedbackTone === "error"
                ? "text-rose-200"
                : "text-slate-100"
          )}
        >
          {keyFeedback}
        </p>
      ) : null}
      <p className="m-0 max-w-[44ch] text-lime-300 [text-shadow:0_0_10px_rgba(190,242,100,0.45)] text-xs italic leading-relaxed">
        Server-side validation. Never stored in browser.
      </p>
    </section>
  );
}
