import { CROWD_LAG_AFTER_MUSIC_MS, FADE_OUT_MS, SOUND_TRACKS } from "@/lib/audio/tracks";

/**
 * Layered-audio orchestrator. Owns two `HTMLAudioElement` instances
 * (created via `new Audio()` so they don't pollute the DOM) and
 * provides idempotent, fade-driven controls.
 *
 * Design notes:
 *  - `requestAnimationFrame` for fades — drift-free over time, batches
 *    with rendering, idle-friendly in background tabs.
 *  - Per-element fade tokens so a new fade cancels the previous one on
 *    the same element without affecting the other track.
 *  - All `play()` calls are wrapped in try/catch: browsers reject the
 *    promise when autoplay rules are unmet. Caller decides what to do.
 *  - `preload="metadata"` until first play, then upgraded to `"auto"`.
 *    Avoids pre-downloading multiple MB on first paint.
 */

type FadeToken = { aborted: boolean };

interface ElementFadeState {
  active: FadeToken | null;
}

export class AudioOrchestrator {
  private readonly crowd: HTMLAudioElement;
  private readonly music: HTMLAudioElement;
  private readonly fades = new WeakMap<HTMLAudioElement, ElementFadeState>();
  private destroyed = false;

  constructor() {
    this.crowd = new Audio();
    this.crowd.src = SOUND_TRACKS.crowd.src;
    this.crowd.loop = SOUND_TRACKS.crowd.loop;
    this.crowd.volume = 0;
    this.crowd.preload = "metadata";
    this.crowd.crossOrigin = "anonymous";

    this.music = new Audio();
    this.music.src = SOUND_TRACKS.music.src;
    this.music.loop = SOUND_TRACKS.music.loop;
    this.music.volume = 0;
    this.music.preload = "metadata";
    this.music.crossOrigin = "anonymous";

    this.fades.set(this.crowd, { active: null });
    this.fades.set(this.music, { active: null });
  }

  /**
   * Begin (or resume) the crowd ambience.
   *
   * MUST be called inside a user-gesture event handler (click, keypress)
   * — otherwise the browser will reject the `play()` promise per the
   * autoplay policy. The Verify-key click is the canonical trigger.
   */
  async startCrowd(): Promise<void> {
    if (this.destroyed) return;
    this.crowd.preload = "auto";
    if (this.crowd.paused) {
      this.crowd.currentTime = 0;
      try {
        await this.crowd.play();
      } catch {
        // Autoplay blocked or load failure — caller can't recover from
        // here; surface silence rather than crash.
        return;
      }
    }
    await this.fade(
      this.crowd,
      SOUND_TRACKS.crowd.targetVolume,
      SOUND_TRACKS.crowd.crowdEntryFadeMs
    );
  }

  /**
   * Begin the music track. Safe to call once the audio context is
   * already unlocked (crowd is playing). Idempotent.
   */
  async startMusic(): Promise<void> {
    if (this.destroyed) return;
    this.music.preload = "auto";
    if (this.music.paused) {
      this.music.currentTime = 0;
      try {
        await this.music.play();
      } catch {
        return;
      }
    }
    await this.fade(this.music, SOUND_TRACKS.music.targetVolume, SOUND_TRACKS.music.fadeInMs);
  }

  /**
   * Staggered shutdown: music fades out first, then 1.5s of pause,
   * then crowd fades. Mirrors the build-up: crowd was the
   * foundation, so it leaves last.
   */
  async stopAll(): Promise<void> {
    if (this.destroyed) return;
    await this.fade(this.music, 0, FADE_OUT_MS);
    this.music.pause();
    this.music.currentTime = 0;
    await delay(CROWD_LAG_AFTER_MUSIC_MS);
    await this.fade(this.crowd, 0, FADE_OUT_MS);
    this.crowd.pause();
    this.crowd.currentTime = 0;
  }

  /**
   * Mute: fade both to 0 in parallel and pause. Position is preserved
   * so `resume()` can continue from where the user muted.
   */
  async mute(durationMs = 600): Promise<void> {
    if (this.destroyed) return;
    await Promise.all([this.fade(this.crowd, 0, durationMs), this.fade(this.music, 0, durationMs)]);
    this.crowd.pause();
    this.music.pause();
  }

  /**
   * Resume from a muted state. `phase` controls which tracks come back.
   * Plays from the position they were paused at — does not restart from 0.
   */
  async resume(phase: "crowd-only" | "crowd-and-music", durationMs = 600): Promise<void> {
    if (this.destroyed) return;
    try {
      await this.crowd.play();
      await this.fade(this.crowd, SOUND_TRACKS.crowd.targetVolume, durationMs);
    } catch {
      return;
    }
    if (phase === "crowd-and-music") {
      try {
        await this.music.play();
        await this.fade(this.music, SOUND_TRACKS.music.targetVolume, durationMs);
      } catch {
        // Music resume failed; crowd still continues.
      }
    }
  }

  /** Hard teardown. Idempotent. Called from component unmount. */
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.cancelFade(this.crowd);
    this.cancelFade(this.music);
    this.crowd.pause();
    this.music.pause();
    this.crowd.src = "";
    this.music.src = "";
  }

  // ────────────────────────────────────────────────────────────────────
  // Internals
  // ────────────────────────────────────────────────────────────────────

  private fade(element: HTMLAudioElement, targetVolume: number, durationMs: number): Promise<void> {
    this.cancelFade(element);

    return new Promise((resolve) => {
      const state = this.fades.get(element);
      if (state === undefined) {
        // Element not tracked — shouldn't happen, but fail closed.
        resolve();
        return;
      }
      const token: FadeToken = { aborted: false };
      state.active = token;

      const startVolume = element.volume;
      const startTime = performance.now();

      const tick = (now: number) => {
        if (token.aborted || this.destroyed) {
          resolve();
          return;
        }
        const elapsed = now - startTime;
        const progress = Math.min(1, elapsed / durationMs);
        const eased = progress * (2 - progress); // easeOutQuad
        element.volume = clamp01(startVolume + (targetVolume - startVolume) * eased);
        if (progress < 1) {
          requestAnimationFrame(tick);
        } else {
          element.volume = clamp01(targetVolume);
          state.active = null;
          resolve();
        }
      };

      requestAnimationFrame(tick);
    });
  }

  private cancelFade(element: HTMLAudioElement): void {
    const state = this.fades.get(element);
    if (state?.active) {
      state.active.aborted = true;
      state.active = null;
    }
  }
}

function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
