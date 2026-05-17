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
  private crowdSource: AudioBufferSourceNode | null = null;
  private crowdGain: GainNode | null = null;

  // Decoded-buffer cache keyed by source URL. Single source of truth for
  // both crowd ambience and one-shot SFX (e.g. boo) — first call decodes,
  // subsequent calls reuse the same Promise so concurrent loads dedupe.
  private readonly bufferCache = new Map<string, Promise<AudioBuffer>>();

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
   * Synchronously create and `resume()` the AudioContext within a user-
   * gesture event handler. MUST be called from the synchronous body of
   * a pointerdown / touchstart / keydown / click handler — any async
   * function entry before this call (even an awaited call to another
   * async function) shifts construction into a microtask that Chrome's
   * autoplay-policy reporter does not trust as gesture-driven, emitting
   * the "AudioContext was not allowed to start" informational log.
   *
   * Splitting the synchronous gesture-time unlock out of the async
   * playback pipeline is the W3C autoplay-policy compliance pattern
   * (spec §3.2.2: "the user agent should resume the AudioContext if
   * sticky activation is present at construction"). Construction +
   * resume happen on the synchronous call stack of the gesture handler,
   * so Chrome verifies user activation and grants both without warning.
   *
   * Idempotent — second and subsequent calls are no-ops. After this
   * returns, the async `startCrowd` / `playBoo` paths skip the lazy-
   * init branch in `ensureAudioContext` and proceed straight to
   * playback.
   */
  unlockAudioContextSync(): void {
    if (this.destroyed) return;
    if (this.audioContext !== null) return;

    const Ctor: typeof AudioContext | undefined =
      typeof window !== "undefined"
        ? (window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)
        : undefined;
    if (Ctor === undefined) return;

    this.audioContext = new Ctor();
    // Fire-and-forget resume. The call lands within the synchronous
    // gesture frame so Chrome's transient-activation check passes; we
    // don't await because callers of this method are themselves
    // synchronous gesture handlers. The async `startCrowd` /
    // `ensureAudioContext` paths re-check `state` and await as needed.
    void this.audioContext.resume();
  }

  /**
   * Begin (or resume) the crowd ambience. Pre-unlock via
   * `unlockAudioContextSync()` from the synchronous gesture frame is
   * the recommended caller pattern — it suppresses Chrome's
   * informational autoplay warning. Calling this method on its own
   * still works (the fallback path in `ensureAudioContext` lazily
   * constructs the context), but Chrome may log the warning the first
   * time. Idempotent: a second call just re-fades to target volume
   * without restarting the loop.
   */
  async startCrowd(): Promise<void> {
    if (this.destroyed) return;

    try {
      const ctx = await this.ensureAudioContext();
      const buffer = await this.loadBuffer(ctx, SOUND_TRACKS.crowd.src);

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
   * Layer a one-shot booing reaction over the running crowd ambience.
   * No-op if the audio context has not yet been unlocked by an earlier
   * `startCrowd()` user-gesture call — playBoo is a layered effect, not
   * a primary unlock path. Uses its own source + gain node so the crowd's
   * envelope is unaffected (no ducking; intentional per UX decision).
   * Idempotent under rapid retries — each invocation creates an
   * independent graph that self-cleans on the source's `ended` event.
   */
  async playBoo(): Promise<void> {
    if (this.destroyed) return;
    const ctx = this.audioContext;
    if (ctx === null || ctx.state === "suspended") return;

    try {
      const buffer = await this.loadBuffer(ctx, SOUND_TRACKS.boo.src);
      if (this.destroyed) return;

      const source = ctx.createBufferSource();
      source.buffer = buffer;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(
        SOUND_TRACKS.boo.targetVolume,
        ctx.currentTime + SOUND_TRACKS.boo.fadeInMs / 1000
      );

      source.connect(gain);
      gain.connect(ctx.destination);
      source.start();

      source.addEventListener("ended", () => {
        try {
          source.disconnect();
          gain.disconnect();
        } catch {
          // Already disconnected by destroy() — fine.
        }
      });
    } catch {
      // Buffer load / decode failed or context lost — silence is fine.
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

  /**
   * Async fallback for callers that did not pre-unlock via
   * `unlockAudioContextSync()`. Constructing the AudioContext from
   * inside this async function body may trigger Chrome's
   * "AudioContext was not allowed to start" informational log on the
   * first call — Chrome's autoplay reporter does not trust gesture-
   * frame inheritance through async function entry. Prefer the sync
   * unlock path from gesture handlers; this fallback keeps the
   * orchestrator robust for any caller that wires `startCrowd`
   * directly without pre-unlock.
   */
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

  /**
   * Cached buffer loader. First call for a given `src` fetches + decodes;
   * subsequent calls return the same Promise so concurrent callers share
   * a single network + decode. Used by both `startCrowd` (looped ambience)
   * and `playBoo` (one-shot SFX) — adding a new layered track is one
   * entry in SOUND_TRACKS + one playback method, no new caching code.
   */
  private loadBuffer(ctx: AudioContext, src: string): Promise<AudioBuffer> {
    let cached = this.bufferCache.get(src);
    if (cached === undefined) {
      cached = (async () => {
        const response = await fetch(src, { cache: "force-cache" });
        const arrayBuffer = await response.arrayBuffer();
        return await ctx.decodeAudioData(arrayBuffer);
      })();
      this.bufferCache.set(src, cached);
    }
    return cached;
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
