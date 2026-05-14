/**
 * Confetti preset functions for the Coldplay AI Companion. All triggers use
 * the same vibrant palette so confetti reads as part of the visual system,
 * not generic canvas-confetti rainbow noise.
 *
 * canvas-confetti owns its overlay canvas singleton — these functions just
 * call into it with our preset options. No React component, no JSX, no ref
 * dance. Importable from anywhere on the client.
 *
 * All functions are no-ops on the server (canvas-confetti requires `window`)
 * and when the user has `prefers-reduced-motion: reduce` set — confetti is
 * pure decoration and accessibility comes first.
 */

import confetti from "canvas-confetti";

/**
 * Coldplay vibrant palette — pulled from `@theme` tokens in globals.css
 * (aurora-cyan, aurora-magenta, aurora-amber) plus complementary brights
 * that read well against the dark glass and aurora gradient backgrounds.
 */
const COLDPLAY_COLORS = [
  "#7DF9FF", // cyan (aurora-cyan)
  "#7DD3FC", // sky
  "#A78BFA", // violet
  "#F472B6", // fuchsia (aurora-magenta)
  "#FDE047", // amber (aurora-amber)
  "#BEF264", // lime
  "#FB7185", // rose
  "#FFFFFF", // white sparkle
];

const Z_INDEX = 50;

/** Returns true when the runtime supports confetti AND the user hasn't
 *  opted out of motion. All public preset functions gate on this. */
function shouldFireConfetti(): boolean {
  if (typeof window === "undefined") return false;
  return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function randomInRange(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

/**
 * Single celebratory burst from low-center, particles arc upward. Used for
 * "user sent a message" feedback on desktop.
 */
export function fireBasic(): void {
  if (!shouldFireConfetti()) return;
  void confetti({
    particleCount: 120,
    spread: 72,
    startVelocity: 38,
    origin: { x: 0.5, y: 0.7 },
    colors: COLDPLAY_COLORS,
    ticks: 220,
    zIndex: Z_INDEX,
    scalar: 1.05,
  });
}

/**
 * Random-direction burst — particles spray outward from a random low-screen
 * point. Used on mobile where the upward `fireBasic` is partially clipped
 * by the on-screen keyboard / small viewport (confetti would fall off
 * screen before being seen). Random direction stays on-screen better.
 */
export function fireRandomDirection(): void {
  if (!shouldFireConfetti()) return;
  void confetti({
    particleCount: 90,
    angle: randomInRange(45, 135),
    spread: 110,
    startVelocity: 32,
    origin: { x: randomInRange(0.25, 0.75), y: randomInRange(0.55, 0.75) },
    colors: COLDPLAY_COLORS,
    ticks: 200,
    zIndex: Z_INDEX,
    scalar: 0.95,
  });
}

/**
 * Fireworks — staccato bursts from two opposite sides of the screen over
 * 5 seconds. Used as an ambient effect.
 */
export function fireFireworks(): void {
  if (!shouldFireConfetti()) return;

  const duration = 5000;
  const animationEnd = Date.now() + duration;
  const defaults = {
    startVelocity: 30,
    spread: 360,
    ticks: 60,
    zIndex: Z_INDEX,
    colors: COLDPLAY_COLORS,
  };

  const interval = window.setInterval(() => {
    const timeLeft = animationEnd - Date.now();
    if (timeLeft <= 0) {
      window.clearInterval(interval);
      return;
    }
    const particleCount = 50 * (timeLeft / duration);
    void confetti({
      ...defaults,
      particleCount,
      origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
    });
    void confetti({
      ...defaults,
      particleCount,
      origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
    });
  }, 250);
}

/**
 * Side cannons — continuous low-angle streams from screen left + right
 * edges for 3 seconds. Looks like a stadium pyro hit.
 */
export function fireSideCannons(): void {
  if (!shouldFireConfetti()) return;

  const end = Date.now() + 3000;
  const defaults = {
    spread: 55,
    ticks: 80,
    zIndex: Z_INDEX,
    colors: COLDPLAY_COLORS,
    startVelocity: 45,
  };

  const frame = () => {
    if (Date.now() > end) return;
    void confetti({
      ...defaults,
      particleCount: 3,
      angle: 60,
      origin: { x: 0, y: 0.7 },
    });
    void confetti({
      ...defaults,
      particleCount: 3,
      angle: 120,
      origin: { x: 1, y: 0.7 },
    });
    window.requestAnimationFrame(frame);
  };
  frame();
}

/**
 * Used by chat composer + prompt buttons. Picks the right preset based on
 * viewport: desktop → upward burst, mobile → random direction (the upward
 * basic gets clipped on small screens / under the keyboard).
 */
export function fireOnUserAction(): void {
  if (typeof window === "undefined") return;
  const isMobile = window.matchMedia("(max-width: 640px)").matches;
  if (isMobile) {
    fireRandomDirection();
  } else {
    fireBasic();
  }
}
