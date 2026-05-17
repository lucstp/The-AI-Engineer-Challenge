"use client";

import { cn } from "@/lib/utils";

interface CrowdSilhouetteProps {
  /**
   * Whether the user has verified an OpenAI key. The silhouette slides in
   * after verification — pairs with the music kick-in moment so it reads
   * as "lights come up, show begins."
   */
  isVisible: boolean;
}

/**
 * Concert-crowd silhouette pinned to the bottom of the viewport, behind the
 * chat shell + disclaimer. Two PNGs of different crowd poses cross-fade on
 * a 12-second loop while the inner stack subtly bobs — suggests a living
 * audience rather than a frozen still.
 *
 * Animations use Tailwind v4 `animate-*` utilities registered in
 * `globals.css` `@theme` block (`--animate-crowd-bob`, `--animate-crowd-
 * fade-a/b`). This is the v4-idiomatic way and is reliably consumed by
 * the parser — plain CSS animation rules in regular blocks proved flaky.
 *
 * STRUCTURE — two wrappers so two transforms can coexist:
 *   <outer>     position: fixed, translate-y for the slide-in entrance
 *     <inner>   animate-crowd-bob (vertical sway)
 *       <img-a> animate-crowd-fade-a (visible 0–42%, fading 42–50%)
 *       <img-b> animate-crowd-fade-b (offset; visible 50–92%)
 *
 * PNGs are pre-processed offline to true RGBA (black silhouettes on
 * transparent background) — no blend-mode hacks needed.
 */
export function CrowdSilhouette({ isVisible }: CrowdSilhouetteProps) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none fixed inset-x-0 bottom-0 h-[55vh] overflow-hidden transition-transform duration-[1200ms] ease-out",
        isVisible ? "translate-y-0" : "translate-y-full"
      )}
      style={{ zIndex: -1 }}
    >
      <div className="relative h-full w-full animate-crowd-bob">
        <img
          src="/concert-crowd.png"
          alt=""
          className="absolute inset-x-0 bottom-0 h-full w-full animate-crowd-fade-a object-cover"
          style={{ objectPosition: "50% 25%" }}
          loading="eager"
          decoding="async"
        />
        <img
          src="/concert-crowd-2.png"
          alt=""
          className="absolute inset-x-0 bottom-0 h-full w-full animate-crowd-fade-b object-cover"
          style={{ objectPosition: "50% 25%" }}
          loading="eager"
          decoding="async"
        />
      </div>
    </div>
  );
}
