import { useCallback, useEffect, useRef, useState } from "react";

import { AudioOrchestrator } from "@/lib/audio/audio-orchestrator";

/**
 * Stages of the layered-audio experience, matched to chat-shell state:
 *   - "idle":             before first user gesture (no audio yet)
 *   - "crowd-only":       crowd ambience plays under the locked card
 *                         (or under the chat for returning users), kicked
 *                         off by the very first user interaction with
 *                         the page — pointerdown / keydown / touchstart.
 *                         Browsers WILL NOT let us call `play()` on page
 *                         load without a user gesture, so "first
 *                         interaction" is the earliest the spec allows.
 *   - "crowd-and-music":  music joins after the welcome typewriter
 *                         finishes; crowd keeps playing underneath.
 */
type Phase = "idle" | "crowd-only" | "crowd-and-music";

/** Persisted preference key. sessionStorage scope is per-tab. */
const SOUND_PREFERENCE_KEY = "coldplay_sound_enabled_v1";

export interface SoundExperience {
  /** Persisted user preference. True = audio plays when phase advances. */
  isEnabled: boolean;
  /** Current orchestration phase. */
  phase: Phase;
  /** Toggle user preference. Fades out audio if muting, resumes if unmuting. */
  toggleEnabled: () => void;
  /**
   * Synchronously create + resume the AudioContext within a user-
   * gesture event handler's synchronous body. Call BEFORE the async
   * `startCrowd` to suppress Chrome's autoplay-policy informational
   * warning (see audio-orchestrator.ts `unlockAudioContextSync` for
   * the spec-compliance rationale). No-op when sound is disabled.
   */
  unlockAudioContextSync: () => void;
  /** Move to phase "crowd-only" and (if enabled) start crowd. MUST be called from a user-gesture handler. */
  startCrowd: () => Promise<void>;
  /** Move to phase "crowd-and-music" and (if enabled) start music. */
  startMusic: () => Promise<void>;
  /** Layer a one-shot booing reaction over the running crowd ambience. No-op when sound is disabled or context not yet unlocked. */
  playBoo: () => Promise<void>;
  /** Staggered fade-out (music first, then crowd 1.5s later). */
  stopAll: () => Promise<void>;
}

function loadInitialPreference(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const stored = window.sessionStorage.getItem(SOUND_PREFERENCE_KEY);
    if (stored === "false") return false;
  } catch {
    // sessionStorage may be unavailable (Safari private mode, etc.) — fail open
  }
  // Respect prefers-reduced-data: default to off on metered connections.
  try {
    if (window.matchMedia("(prefers-reduced-data: reduce)").matches) return false;
  } catch {
    // matchMedia unavailable; ignore
  }
  return true;
}

/**
 * Orchestrates the crowd + music layered audio across the chat
 * lifecycle. The component tree just calls `startCrowd()` from the
 * Verify-key click handler and `startMusic()` when the welcome
 * typewriter completes; everything else (fades, autoplay-policy
 * handling, preference persistence) is contained here.
 */
export function useSoundExperience(): SoundExperience {
  const orchestratorRef = useRef<AudioOrchestrator | null>(null);
  const phaseRef = useRef<Phase>("idle");
  const [phase, setPhase] = useState<Phase>("idle");
  const [isEnabled, setIsEnabled] = useState<boolean>(true);

  // Initialise orchestrator + preference on mount; tear down on unmount.
  useEffect(() => {
    setIsEnabled(loadInitialPreference());
    orchestratorRef.current = new AudioOrchestrator();
    return () => {
      orchestratorRef.current?.destroy();
      orchestratorRef.current = null;
    };
  }, []);

  // Persist preference on change.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.sessionStorage.setItem(SOUND_PREFERENCE_KEY, String(isEnabled));
    } catch {
      // ignore
    }
  }, [isEnabled]);

  const advancePhase = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const startCrowd = useCallback(async () => {
    advancePhase(phaseRef.current === "idle" ? "crowd-only" : phaseRef.current);
    if (isEnabled) {
      await orchestratorRef.current?.startCrowd();
    }
  }, [advancePhase, isEnabled]);

  const startMusic = useCallback(async () => {
    advancePhase("crowd-and-music");
    if (isEnabled) {
      await orchestratorRef.current?.startMusic();
    }
  }, [advancePhase, isEnabled]);

  const stopAll = useCallback(async () => {
    advancePhase("idle");
    await orchestratorRef.current?.stopAll();
  }, [advancePhase]);

  const playBoo = useCallback(async () => {
    if (!isEnabled) return;
    await orchestratorRef.current?.playBoo();
  }, [isEnabled]);

  const unlockAudioContextSync = useCallback(() => {
    if (!isEnabled) return;
    orchestratorRef.current?.unlockAudioContextSync();
  }, [isEnabled]);

  // Auto-start crowd on the FIRST user gesture anywhere on the page.
  // Browser autoplay policy: `play()` only succeeds when a user-
  // initiated event is on the stack. The earliest such moment is the
  // user's first pointerdown / keydown / touchstart — so we listen for
  // those and fire `startCrowd()` exactly once.
  //
  // Order matters inside the handler: `unlockAudioContextSync` runs
  // on the synchronous call stack of the gesture handler so Chrome
  // accepts the AudioContext construction as gesture-driven (suppresses
  // the autoplay-policy informational log). Only THEN do we kick off
  // the async `startCrowd` for the buffer-load + playback pipeline.
  //
  // Idempotent with the LockedKeyCard `onBeforeSubmit` path (Verify
  // click also calls startCrowd). If the Verify click *is* the first
  // gesture, both fire and the second is a no-op.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (phaseRef.current !== "idle") return;

    let triggered = false;
    const handler = () => {
      if (triggered) return;
      triggered = true;
      removeListeners();
      unlockAudioContextSync();
      void startCrowd();
    };
    const removeListeners = () => {
      window.removeEventListener("pointerdown", handler);
      window.removeEventListener("keydown", handler);
      window.removeEventListener("touchstart", handler);
    };

    window.addEventListener("pointerdown", handler, { passive: true });
    window.addEventListener("keydown", handler, { passive: true });
    window.addEventListener("touchstart", handler, { passive: true });

    return removeListeners;
  }, [startCrowd, unlockAudioContextSync]);

  const toggleEnabled = useCallback(() => {
    setIsEnabled((current) => {
      const next = !current;
      const orchestrator = orchestratorRef.current;
      if (orchestrator === null) return next;
      if (!next) {
        // Muting: fade out both tracks, keep phase intact for later resume.
        void orchestrator.mute();
      } else if (phaseRef.current !== "idle") {
        // Unmuting mid-experience: resume per current phase.
        void orchestrator.resume(phaseRef.current);
      }
      return next;
    });
  }, []);

  return {
    isEnabled,
    phase,
    toggleEnabled,
    unlockAudioContextSync,
    startCrowd,
    startMusic,
    playBoo,
    stopAll,
  };
}
