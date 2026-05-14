/**
 * Handwritten "Love is the only answer" SVG — Coldplay-mood epigraph used
 * as page-margin decoration. Renders twice on the home page, once at
 * upper-left and once at middle-right of the chat shell, framing the
 * conversation diagonally. Visible only at `lg+` viewports where there is
 * actual negative space to live in.
 */

interface LoveIsTheOnlyAnswerProps {
  className?: string;
}

export function LoveIsTheOnlyAnswer({ className }: LoveIsTheOnlyAnswerProps) {
  return (
    <img
      src="/web-content-Group-1050.svg"
      alt="Love is the only answer"
      aria-hidden
      className={className}
    />
  );
}
