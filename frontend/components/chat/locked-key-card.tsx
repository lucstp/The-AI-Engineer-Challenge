"use client";

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
  isVerifyingKey: boolean;
  isApiKeyVerified: boolean;
  keyFeedback: string | null;
  keyFeedbackTone: KeyFeedbackTone | null;
  isSwappingPanel: boolean;
}

/**
 * Compact "unlock the chat" card shown when the OpenAI key has not yet been
 * verified. Lives inside the chat shell and centers itself vertically within
 * the available space. The shell wrapper transitions height between this
 * compact state and the full-chat state on a soft spring curve.
 *
 * PR 14 adds an `onBeforeSubmit` audio-gesture hook + a "Turn on sound" pill
 * above the form. Keep the prop surface stable so that extension is additive.
 */
export function LockedKeyCard({
  apiKeyInput,
  onApiKeyInputChange,
  onSubmit,
  isVerifyingKey,
  isApiKeyVerified,
  keyFeedback,
  keyFeedbackTone,
  isSwappingPanel,
}: LockedKeyCardProps) {
  return (
    <section
      aria-label="OpenAI key verification"
      className={cn(
        "flex flex-col items-center gap-3 px-2 py-2 text-center sm:gap-4 sm:py-4",
        isSwappingPanel ? "panel-exit" : "panel-enter"
      )}
    >
      <h2 className="m-0 bg-linear-to-r from-cyan-300 via-fuchsia-400 to-violet-400 bg-clip-text font-bold text-transparent text-xl leading-tight sm:text-2xl">
        Unlock your Coldplay companion
      </h2>
      <p className="m-0 max-w-[44ch] text-sm text-white/90 leading-relaxed [text-shadow:0_1px_2px_rgba(0,0,0,0.4)] sm:text-base">
        Enter your OpenAI key to begin.
      </p>
      <form
        onSubmit={onSubmit}
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
        <Button
          type="submit"
          disabled={isVerifyingKey || apiKeyInput.trim().length === 0}
          className="locked-verify-btn h-12 px-7 text-base"
        >
          {isVerifyingKey ? "Verifying..." : "Verify key"}
        </Button>
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
      <p className="m-0 max-w-[44ch] text-white/65 text-xs italic leading-relaxed">
        Server-side validation. Never stored in browser.
      </p>
    </section>
  );
}
