"use client";

import { useEffect } from "react";

import { fireFireworks, fireSideCannons } from "@/lib/confetti";

interface UseAmbientConfettiOptions {
  /**
   * Whether the ambient timer should be running. Pass `false` to pause
   * (e.g., while the chat is locked — no point firing confetti at someone
   * who's still entering a key).
   */
  enabled: boolean;
}

/**
 * Schedules ambient confetti bursts (alternating fireworks + side cannons)
 * while the chat is unlocked. Built with FAANG-grade defensive timing:
 *
 * - **Visibility-aware**: pauses while the tab is hidden (no point burning
 *   CPU + animation frames in a background tab; users return to a fresh
 *   moment instead of a stale loop).
 * - **Reduced motion**: respects `prefers-reduced-motion` — the preset
 *   functions themselves short-circuit when the media query matches, but
 *   we also skip scheduling entirely so we're not running idle timers.
 * - **Cleanup-clean**: every `setTimeout` is captured and cleared on
 *   unmount; no orphaned timers if the component remounts in dev or the
 *   user disconnects.
 * - **Randomized intervals**: 70–120s for fireworks, 50–100s for side
 *   cannons — staggered + jittered so they don't synchronize into a
 *   predictable beat.
 * - **Initial delay**: 12s on mount so the first burst lands AFTER the
 *   welcome typewriter + music settle in, not on top of them.
 */
export function useAmbientConfetti({ enabled }: UseAmbientConfettiOptions): void {
  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let fireworksTimer: number | null = null;
    let cannonsTimer: number | null = null;

    const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

    const scheduleFireworks = (initialDelayMs: number) => {
      fireworksTimer = window.setTimeout(() => {
        if (!document.hidden) fireFireworks();
        // After firing, schedule next at a fresh random interval.
        scheduleFireworks(randomInRange(70000, 120000));
      }, initialDelayMs);
    };

    const scheduleCannons = (initialDelayMs: number) => {
      cannonsTimer = window.setTimeout(() => {
        if (!document.hidden) fireSideCannons();
        scheduleCannons(randomInRange(50000, 100000));
      }, initialDelayMs);
    };

    // Staggered initial delays so fireworks + cannons don't fire at the
    // same instant on first run. 12s + 28s respectively.
    scheduleFireworks(12000);
    scheduleCannons(28000);

    return () => {
      if (fireworksTimer !== null) window.clearTimeout(fireworksTimer);
      if (cannonsTimer !== null) window.clearTimeout(cannonsTimer);
    };
  }, [enabled]);
}
