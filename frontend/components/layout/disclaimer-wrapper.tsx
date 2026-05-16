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
 * through artifact above the composer (a browser backdrop-filter +
 * sibling-stacking-context quirk: the chat shell's `backdrop-blur-[20px]`
 * sampled content adjacent to the disclaimer region differently when
 * the wrapper was present, allowing the body bg's amber radial gradient
 * at `circle at 48% 88%` to read through to the composer area).
 *
 * Legal posture preserved across both states:
 *   • Locked / landing state — full disclaimer paragraph + audio
 *     credits rendered, prominent on first impression.
 *   • Verified / chatting state — the small italic Pond5 attribution
 *     below `<ChatComposer>` (in `<ChatPanel>`) satisfies the audio-
 *     license attribution requirement at all times during chat use.
 */
export function DisclaimerWrapper({ children }: DisclaimerWrapperProps) {
  const { isChatLocked } = useLockState();
  if (!isChatLocked) {
    return null;
  }
  return <div data-disclaimer-wrapper>{children}</div>;
}
