/**
 * Handwritten "Love is the only answer" SVG — Coldplay-mood epigraph used
 * as page-margin decoration. Renders twice on the home page, once at
 * upper-left and once at middle-right of the chat shell, framing the
 * conversation diagonally. Visible only at `lg+` viewports where there is
 * actual negative space to live in.
 *
 * Provenance: this SVG was sourced from coldplay.com — it is a Coldplay
 * brand asset, not original work. Its use here is covered by the
 * non-commercial educational fair-use posture documented in the
 * `<DisclaimerFooter>`; the arrangement is temporary and the asset
 * should eventually be replaced with original artwork.
 *
 * Rendered as a raw `<img>` (NOT `next/image`) by design: Vercel's image
 * optimization pipeline explicitly excludes SVGs — there is no AVIF /
 * WebP conversion benefit, no responsive-srcset story (SVG is already
 * resolution-independent), and routing through the optimizer just adds
 * a hop without compressing the asset. The SVG is self-hosted in
 * `public/` so there's no external CDN dependency.
 *
 * `loading="lazy"` + `decoding="async"`: the SVG is `display: hidden` below
 * 2xl (see `app/page.tsx` call sites) and lives in the page margins, never
 * above-the-fold. Lazy + async lets the browser skip the fetch entirely on
 * viewports where the element is display:none, and decode off the main
 * thread when it ever does come into view.
 */

interface LoveIsTheOnlyAnswerProps {
  className?: string;
}

export function LoveIsTheOnlyAnswer({ className }: LoveIsTheOnlyAnswerProps) {
  return (
    <img
      src="/decoration/love-is-the-only-answer.svg"
      alt="Love is the only answer"
      aria-hidden
      loading="lazy"
      decoding="async"
      className={className}
    />
  );
}
