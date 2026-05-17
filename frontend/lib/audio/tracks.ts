/**
 * Audio track manifest. Keeping it as a small const lets the
 * orchestrator stay generic and lets future tracks be added by edit
 * here only.
 *
 * Volumes are tuned so the crowd ambience sits under the music after
 * the welcome message — the music carries the foreground.
 */
export const SOUND_TRACKS = {
  crowd: {
    src: "/audio/crowd.mp3",
    targetVolume: 0.28,
    loop: true,
    crowdEntryFadeMs: 800,
  },
  music: {
    // Streamed via the Next.js route handler at `app/api/audio/
    // aerophonia/route.ts`, which reads the licensed full track from
    // `private/audio/` — outside Next's public/ static serving — so
    // there is no predictable direct-download URL. Honest IP posture
    // documented in that route's header comment.
    src: "/api/audio/aerophonia",
    targetVolume: 0.8,
    loop: false,
    fadeInMs: 2500,
  },
  // One-shot crowd reaction layered over the running crowd ambience on
  // an invalid-key validation result. Played through its own gain node
  // so it does not affect the crowd's envelope (no ducking — see
  // architectural note in audio-orchestrator.ts).
  boo: {
    src: "/audio/crowd-booing.mp3",
    targetVolume: 0.5,
    loop: false,
    fadeInMs: 400,
  },
} as const;

export const FADE_OUT_MS = 1500;
/** Crowd fades out 1.5s AFTER music has finished fading out. */
export const CROWD_LAG_AFTER_MUSIC_MS = 1500;
