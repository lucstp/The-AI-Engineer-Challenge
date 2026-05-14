"use client";

import { useEffect, useMemo, useRef, useState } from "react";

interface TypewriterTextProps {
  text: string;
  animate: boolean;
  durationMs?: number;
  onAnimationDone?: () => void;
}

function usePrefersReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setPrefersReducedMotion(mediaQuery.matches);
    update();
    mediaQuery.addEventListener("change", update);
    return () => mediaQuery.removeEventListener("change", update);
  }, []);

  return prefersReducedMotion;
}

export function TypewriterText({
  text,
  animate,
  durationMs,
  onAnimationDone,
}: TypewriterTextProps) {
  const reducedMotion = usePrefersReducedMotion();
  const shouldAnimate = animate && !reducedMotion;
  const [visibleText, setVisibleText] = useState(shouldAnimate ? "" : text);
  const doneRef = useRef(false);

  // Stable handle for the animation-complete callback. The parent passes
  // an inline arrow each render (e.g. `() => onAnimationDone(message.id)`
  // in MessageList) — depending on its identity in the animation effect
  // would restart the typewriter on every unrelated parent re-render
  // (sound fade ticks, persist effects, scroll updates). The ref keeps
  // the effect deps stable.
  const onAnimationDoneRef = useRef(onAnimationDone);
  useEffect(() => {
    onAnimationDoneRef.current = onAnimationDone;
  }, [onAnimationDone]);

  const frames = useMemo(() => {
    if (!shouldAnimate) {
      return [text];
    }

    const targetDurationMs = durationMs ?? Math.min(900, Math.max(220, text.length * 4));
    const idealFrameCount = Math.max(8, Math.min(42, Math.round(targetDurationMs / 22)));
    const chunkSize = Math.max(1, Math.ceil(text.length / idealFrameCount));
    const chunks: string[] = [];
    for (let i = chunkSize; i <= text.length; i += chunkSize) {
      chunks.push(text.slice(0, i));
    }
    if (chunks[chunks.length - 1] !== text) {
      chunks.push(text);
    }
    return chunks;
  }, [durationMs, shouldAnimate, text]);

  useEffect(() => {
    doneRef.current = false;
    if (!shouldAnimate) {
      setVisibleText(text);
      if (!doneRef.current) {
        doneRef.current = true;
        onAnimationDoneRef.current?.();
      }
      return;
    }

    setVisibleText("");
    let frameIndex = 0;
    const totalDurationMs = durationMs ?? Math.min(900, Math.max(220, text.length * 4));
    const stepMs = Math.max(12, Math.round(totalDurationMs / Math.max(frames.length, 1)));

    const timer = window.setInterval(() => {
      setVisibleText(frames[frameIndex] ?? text);
      frameIndex += 1;

      if (frameIndex >= frames.length) {
        window.clearInterval(timer);
        if (!doneRef.current) {
          doneRef.current = true;
          onAnimationDoneRef.current?.();
        }
      }
    }, stepMs);

    return () => {
      window.clearInterval(timer);
    };
    // onAnimationDone intentionally NOT in deps — read via ref above.
    // Including it would restart the typewriter on every parent re-render.
  }, [durationMs, frames, shouldAnimate, text]);

  return <>{visibleText}</>;
}
