"use client";

import type { ReactNode } from "react";

import { useLockState } from "@/components/layout/layout-root";

interface DisclaimerWrapperProps {
  children: ReactNode;
}

/**
 * Conditionally renders the disclaimer footer ONLY in the locked
 * (landing) state. In the verified / chatting state, the wrapper
 * unmounts entirely — its DOM presence was producing a visible bleed-
 * through artifact above the composer (most plausibly a browser
 * backdrop-filter + sibling-stacking-context quirk: the chat shell's
 * `backdrop-blur-[20px]` was sampling content adjacent to the
 * disclaimer region differently when the wrapper was present, allowing
 * the body bg's amber radial gradient at `circle at 48% 88%` to read
 * through to the composer area).
 *
 * Legal posture is preserved:
 *   • Locked / landing state — full disclaimer paragraph + audio
 *     credits rendered, prominent on first impression.
 *   • Verified / chatting state — the small italic Pond5 attribution
 *     above `<ChatComposer>` (in `<ChatPanel>`) satisfies the audio-
 *     license attribution requirement at all times.
 *   • Bug #1.7 follow-up: an "ⓘ" icon in `ConnectionStatusCard` will
 *     open a modal with the full disclaimer text for users mid-chat
 *     who want to see it.
 */
export function DisclaimerWrapper({ children }: DisclaimerWrapperProps) {
  const { isChatLocked } = useLockState();
  if (!isChatLocked) {
    return null;
  }
  return <div data-disclaimer-wrapper>{children}</div>;
}
