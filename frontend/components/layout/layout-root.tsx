"use client";

import { createContext, type ReactNode, useContext, useMemo, useState } from "react";

import { cn } from "@/lib/utils";

interface LockStateValue {
  isChatLocked: boolean;
  setIsChatLocked: (locked: boolean) => void;
}

const LockStateContext = createContext<LockStateValue | null>(null);

/**
 * Subscribe to the page-layout chat-locked state. ChatShell propagates
 * its derived `isChatLocked` (from `useKeyLifecycle`) into this context
 * so the layout className updates declaratively — no DOM mutation, no
 * compiled-CSS-selector contract to keep in sync with SSR markup.
 */
export function useLockState(): LockStateValue {
  const ctx = useContext(LockStateContext);
  if (ctx === null) {
    throw new Error("useLockState must be used within <LayoutRoot>.");
  }
  return ctx;
}

interface LayoutRootProps {
  initialIsApiKeyVerified: boolean;
  children: ReactNode;
}

/**
 * Owns the page-layout lock state. Server-renders the correct flex
 * justification from `initialIsApiKeyVerified` so first paint matches
 * final layout — no hydration reflow, no dependency on a compiled CSS
 * attribute selector that can drift from the SSR markup across
 * Turbopack hot-reloads.
 *
 * Replaces the prior `body[data-chat-locked]` / `[data-layout-root]
 * [data-chat-locked]` attribute-selector approach which kept regressing
 * whenever the compiled CSS and SSR markup fell out of sync. Lock state
 * now flows through React state + Tailwind utility classes; the JIT
 * compiler always tracks the class strings present in source, so the
 * "third-time" regression class is eliminated by construction.
 */
export function LayoutRoot({ initialIsApiKeyVerified, children }: LayoutRootProps) {
  const [isChatLocked, setIsChatLocked] = useState(!initialIsApiKeyVerified);
  const value = useMemo<LockStateValue>(() => ({ isChatLocked, setIsChatLocked }), [isChatLocked]);

  return (
    <LockStateContext.Provider value={value}>
      <div
        data-layout-root
        className={cn(
          "mx-auto flex w-full max-w-[1320px] flex-1 flex-col gap-4",
          // flex-1 fills <main> (which is now h-svh + flex flex-col at every
          // breakpoint). Locked → justify-center vertically centers the
          // content block when it fits; <main>'s overflow-y-auto handles
          // shorter viewports where Hero + LockedKeyCard + Disclaimer exceed
          // the viewport. Unlocked → no centering; the chat-shell <section>
          // becomes flex-1 (see chat-shell.tsx) and grows to fill, pinning
          // the composer to the bottom. Same UX at every breakpoint.
          isChatLocked && "justify-center"
        )}
      >
        {children}
      </div>
    </LockStateContext.Provider>
  );
}
