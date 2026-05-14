import { CROWD_LAG_AFTER_MUSIC_MS, FADE_OUT_MS, SOUND_TRACKS } from "@/lib/audio/tracks";

/**
 * Layered-audio orchestrator. Two backends, one API:
 *
 *  • CROWD ambience  → Web Audio API (AudioContext + AudioBufferSourceNode
 *                      with loop=true). Sample-accurate seamless looping
 *                      inside the audio engine itself — no audible gap
 *                      between iterations. HTMLAudioElement `loop` has a
 *                      known ~30-80ms gap on every major browser; we
 *                      cannot ship the user that hiccup every ~30s.
 *
 *  • MUSIC (Aerophonia) → HTMLAudioElement. Plays once, fades out, ends.
 *                          No loop, no seam to fix. Streaming via the
 *                          /api/audio/aerophonia route handler (Vercel
 *                          Blob source). Range-request support matters
 *                          for iOS Safari — keep as HTMLAudioElement.
 *
 * Design notes:
 *  - AudioContext is created LAZY inside the first `startCrowd()` call so
 *    we satisfy the browser autoplay policy (must be initialized inside a
 *    user-gesture frame — the Verify click).
 *  - Crowd buffer is fetched + decoded once and reused. Decoding ~960KB
 *    MP3 takes <100ms on a modern device.
 *  - Gain fades use `linearRampToValueAtTime` against `AudioContext.
 *    currentTime` — sample-accurate, drift-free, no rAF needed.
 *  - Music fades stay rAF-driven (operating on `HTMLAudioElement.volume`).
 *  - Fade cancellation tokens prevent overlapping fades from racing.
 */

type FadeToken = { aborted: boolean };

export class AudioOrchestrator {
  // Music — HTMLAudioElement (no loop, no seam concern)
  private readonly music: HTMLAudioElement;

  // Crowd — Web Audio API (sample-accurate looping)
  private audioContext: AudioContext | null = null;
  private crowdBuffer: AudioBuffer | null = null;
  private crowdSource: AudioBufferSourceNode | null = null;
  private crowdGain: GainNode | null = null;
  private crowdLoadPromise: Promise<AudioBuffer> | null = null;

  // Fade tokens — keyed string so we can address Web Audio crowd + HTML music
  private readonly fades = new Map<"music" | "crowd", FadeToken | null>([
    ["music", null],
    ["crowd", null],
  ]);

  private destroyed = false;

  constructor() {
    this.music = new Audio();
    this.music.src = SOUND_TRACKS.music.src;
    this.music.loop = SOUND_TRACKS.music.loop;
    this.music.volume = 0;
    this.music.preload = "metadata";
    this.music.crossOrigin = "anonymous";
  }

  /**
   * Begin (or resume) the crowd ambience. MUST be called inside a user
   * gesture (Verify-key click) so AudioContext creation is allowed by
   * the autoplay policy. Idempotent: a second call just re-fades to
   * target volume without restarting the loop.
   */
  async startCrowd(): Promise<void> {
    if (this.destroyed) return;

    try {
      const ctx = await this.ensureAudioContext();
      const buffer = await this.loadCrowdBuffer(ctx);

      // Already running — just re-fade up (handles mute→unmute pattern).
      if (this.crowdSource !== null && this.crowdGain !== null) {
        await this.fadeGain(
          this.crowdGain,
          SOUND_TRACKS.crowd.targetVolume,
          SOUND_TRACKS.crowd.crowdEntryFadeMs,
          ctx
        );
        return;
      }

      // Fresh start — wire a new source through a gain node.
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.loopStart = 0;
      source.loopEnd = buffer.duration;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, ctx.currentTime);

      source.connect(gain);
      gain.connect(ctx.destination);
      source.start();

      this.crowdSource = source;
      this.crowdGain = gain;

      await this.fadeGain(
        gain,
        SOUND_TRACKS.crowd.targetVolume,
        SOUND_TRACKS.crowd.crowdEntryFadeMs,
        ctx
      );
    } catch {
      // Web Audio unavailable, buffer load failure, autoplay rejected —
      // surface silence rather than crash. Caller can't recover from here.
      return;
    }
  }

  /**
   * Begin the music track. Safe to call once the audio context is already
   * unlocked (crowd has started). Idempotent.
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
    await this.fadeElement(
      this.music,
      SOUND_TRACKS.music.targetVolume,
      SOUND_TRACKS.music.fadeInMs
    );
  }

  /**
   * Staggered shutdown: music fades out first, then ~1.5s of pause, then
   * crowd fades. Mirrors the build-up — crowd was the foundation, so it
   * leaves last.
   */
  async stopAll(): Promise<void> {
    if (this.destroyed) return;

    await this.fadeElement(this.music, 0, FADE_OUT_MS);
    this.music.pause();
    this.music.currentTime = 0;

    await delay(CROWD_LAG_AFTER_MUSIC_MS);

    if (this.audioContext !== null && this.crowdGain !== null) {
      await this.fadeGain(this.crowdGain, 0, FADE_OUT_MS, this.audioContext);
    }
    this.teardownCrowdGraph();
  }

  /**
   * Mute: fade both to 0 in parallel and pause. Position is preserved so
   * `resume()` can continue from where the user muted.
   */
  async mute(durationMs = 600): Promise<void> {
    if (this.destroyed) return;
    const tasks: Promise<unknown>[] = [this.fadeElement(this.music, 0, durationMs)];
    if (this.audioContext !== null && this.crowdGain !== null) {
      tasks.push(this.fadeGain(this.crowdGain, 0, durationMs, this.audioContext));
    }
    await Promise.all(tasks);
    this.music.pause();
    // We DON'T suspend the audioContext here — that would stop the loop
    // and lose sample position. The gain is at 0 so it's silent anyway.
  }

  /**
   * Resume from a muted state. `phase` controls which tracks come back.
   * Plays from the position they were paused at — does not restart from 0.
   */
  async resume(phase: "crowd-only" | "crowd-and-music", durationMs = 600): Promise<void> {
    if (this.destroyed) return;
    try {
      if (this.audioContext !== null && this.crowdGain !== null) {
        await this.fadeGain(
          this.crowdGain,
          SOUND_TRACKS.crowd.targetVolume,
          durationMs,
          this.audioContext
        );
      }
      if (phase === "crowd-and-music") {
        await this.music.play();
        await this.fadeElement(this.music, SOUND_TRACKS.music.targetVolume, durationMs);
      }
    } catch {
      return;
    }
  }

  /** Hard teardown. Idempotent. Called from component unmount. */
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.cancelFade("music");
    this.cancelFade("crowd");
    this.teardownCrowdGraph();
    if (this.audioContext !== null) {
      void this.audioContext.close();
      this.audioContext = null;
    }
    this.music.pause();
    this.music.src = "";
  }

  // ────────────────────────────────────────────────────────────────────
  // Internals
  // ────────────────────────────────────────────────────────────────────

  private async ensureAudioContext(): Promise<AudioContext> {
    if (this.audioContext === null) {
      const Ctor: typeof AudioContext | undefined =
        typeof window !== "undefined"
          ? (window.AudioContext ??
            (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)
          : undefined;
      if (Ctor === undefined) {
        throw new Error("Web Audio API not supported in this runtime.");
      }
      this.audioContext = new Ctor();
    }
    if (this.audioContext.state === "suspended") {
      await this.audioContext.resume();
    }
    return this.audioContext;
  }

  private async loadCrowdBuffer(ctx: AudioContext): Promise<AudioBuffer> {
    if (this.crowdBuffer !== null) return this.crowdBuffer;
    if (this.crowdLoadPromise !== null) return this.crowdLoadPromise;
    this.crowdLoadPromise = (async () => {
      const response = await fetch(SOUND_TRACKS.crowd.src, { cache: "force-cache" });
      const arrayBuffer = await response.arrayBuffer();
      const buffer = await ctx.decodeAudioData(arrayBuffer);
      this.crowdBuffer = buffer;
      return buffer;
    })();
    return this.crowdLoadPromise;
  }

  private teardownCrowdGraph(): void {
    if (this.crowdSource !== null) {
      try {
        this.crowdSource.stop();
      } catch {
        // Source already stopped — fine.
      }
      this.crowdSource.disconnect();
      this.crowdSource = null;
    }
    if (this.crowdGain !== null) {
      this.crowdGain.disconnect();
      this.crowdGain = null;
    }
  }

  /**
   * Gain fade via Web Audio's own scheduling — sample-accurate, drift-free,
   * runs entirely inside the audio engine. Used for the crowd loop.
   */
  private fadeGain(
    gainNode: GainNode,
    targetVolume: number,
    durationMs: number,
    ctx: AudioContext
  ): Promise<void> {
    this.cancelFade("crowd");
    return new Promise((resolve) => {
      const token: FadeToken = { aborted: false };
      this.fades.set("crowd", token);

      const startTime = ctx.currentTime;
      const startVolume = gainNode.gain.value;
      const endTime = startTime + durationMs / 1000;

      gainNode.gain.cancelScheduledValues(startTime);
      gainNode.gain.setValueAtTime(startVolume, startTime);
      gainNode.gain.linearRampToValueAtTime(targetVolume, endTime);

      window.setTimeout(() => {
        if (!token.aborted && !this.destroyed) {
          this.fades.set("crowd", null);
        }
        resolve();
      }, durationMs);
    });
  }

  /**
   * Volume fade for HTMLAudioElement (music) — rAF-driven, easeOutQuad.
   * AudioContext scheduling can't reach into HTMLAudioElement.volume.
   */
  private fadeElement(
    element: HTMLAudioElement,
    targetVolume: number,
    durationMs: number
  ): Promise<void> {
    this.cancelFade("music");
    return new Promise((resolve) => {
      const token: FadeToken = { aborted: false };
      this.fades.set("music", token);

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
          this.fades.set("music", null);
          resolve();
        }
      };

      requestAnimationFrame(tick);
    });
  }

  private cancelFade(key: "music" | "crowd"): void {
    const token = this.fades.get(key);
    if (token !== null && token !== undefined) {
      token.aborted = true;
      this.fades.set(key, null);
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
