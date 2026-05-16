"use client";

import type { ReactNode } from "react";

import { useLockState } from "@/components/layout/layout-root";

interface HeroWrapperProps {
  children: ReactNode;
}

/**
 * Conditionally renders the Hero (landing intro) ONLY in the locked
 * (landing) state. In the verified / chatting state, the wrapper
 * unmounts the Hero entirely so the chat-shell expands into the freed
 * space — composer naturally lands at the viewport bottom, matching the
 * Claude / ChatGPT / Gemini chat-surface norm.
 *
 * Mirrors `<DisclaimerWrapper>`'s pattern (children-as-prop so the
 * inner Server Component is preserved server-side; Client wrapper only
 * subscribes to `useLockState()` for the conditional render).
 */
export function HeroWrapper({ children }: HeroWrapperProps) {
  const { isChatLocked } = useLockState();
  if (!isChatLocked) {
    return null;
  }
  return <>{children}</>;
}
