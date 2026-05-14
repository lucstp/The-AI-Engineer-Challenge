"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

interface MovingBorderProps extends React.HTMLAttributes<HTMLDivElement> {
  borderRadius?: string;
  durationMs?: number;
  borderWidthPx?: number;
  blobSizePx?: number;
  containerClassName?: string;
  borderClassName?: string;
  contentClassName?: string;
}

export function MovingBorder({
  borderRadius = "1.5rem",
  durationMs = 4200,
  borderWidthPx = 1.5,
  blobSizePx = 120,
  containerClassName,
  borderClassName,
  contentClassName,
  className,
  children,
  style,
  ...props
}: MovingBorderProps) {
  return (
    <div
      // NO `overflow: hidden` on this outer wrapper — that was clipping the
      // chat-shell-glass's outer box-shadow halo (the white/cyan/violet glow)
      // at the rounded corners. The MovingBorderRing uses an absolute-inset
      // mask which defines its own clipping, so removing overflow:hidden does
      // NOT bleed the moving border outside the shell. The INNER content div
      // takes `overflow: hidden` so children (Card, MessageList) still clip
      // cleanly to the rounded shape.
      className={cn("relative", containerClassName, className)}
      style={{ borderRadius, ...style }}
      {...props}
    >
      <MovingBorderRing
        durationMs={durationMs}
        borderWidthPx={borderWidthPx}
        blobSizePx={blobSizePx}
        borderRadius={borderRadius}
        blobClassName={borderClassName}
      />
      {/* NO `overflow: hidden` on this inner content div either. The Card
         child (chat-shell-glass) has its own `overflow-hidden` in
         chat-shell.tsx so child clipping is already handled. Adding it here
         would clip the Card's box-shadow halo (Card paints into the parent
         box, and an overflow:hidden parent clips shadow that extends past
         the box). This was the second clipping layer hiding the glow. */}
      <div className={cn("relative h-full w-full", contentClassName)} style={{ borderRadius }}>
        {children}
      </div>
    </div>
  );
}

interface MovingBorderRingProps {
  durationMs: number;
  borderWidthPx: number;
  blobSizePx: number;
  borderRadius: string;
  blobClassName?: string;
}

function MovingBorderRing({
  durationMs,
  borderWidthPx,
  blobSizePx,
  borderRadius,
  blobClassName,
}: MovingBorderRingProps) {
  const pathRef = React.useRef<SVGRectElement | null>(null);
  const blobRef = React.useRef<HTMLDivElement | null>(null);
  const wrapperRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const path = pathRef.current;
    const blob = blobRef.current;
    const wrapper = wrapperRef.current;
    if (!path || !blob) {
      return;
    }

    let frameId = 0;
    let totalLength = path.getTotalLength();

    const recalc = () => {
      const len = path.getTotalLength();
      if (Number.isFinite(len)) {
        totalLength = len;
      }
    };
    window.addEventListener("resize", recalc);

    // ResizeObserver catches container-level size changes (CSS height
    // transitions on the parent shell, content reflow, etc.) that the
    // window resize event would otherwise miss. Without this, the blob
    // drifts off the perimeter during an animated container resize.
    let observer: ResizeObserver | null = null;
    if (wrapper && typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(recalc);
      observer.observe(wrapper);
    }

    const tick = (time: number) => {
      if (totalLength > 0) {
        const distance = (time * (totalLength / durationMs)) % totalLength;
        const point = path.getPointAtLength(distance);
        blob.style.transform = `translate(${point.x}px, ${point.y}px) translate(-50%, -50%)`;
      }
      frameId = window.requestAnimationFrame(tick);
    };
    frameId = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", recalc);
      observer?.disconnect();
    };
  }, [durationMs]);

  // Mask creates a thin ring along the perimeter so the blob is only
  // visible at the chat's border. Without this the glow would bleed across
  // the translucent glass surface inside the chat.
  // Use explicit mask sub-properties (no shorthand) per React's guidance:
  // mixing the `mask` / `WebkitMask` shorthand with `maskComposite` triggers
  // a rerender bug where React strips the shorthand on update. Listing every
  // sub-property fully and identically across vendor and standard variants
  // avoids the warning AND keeps the ring rendering correct across browsers.
  const maskImage = "linear-gradient(#000 0 0), linear-gradient(#000 0 0)";
  const maskOrigin = "content-box, border-box";
  const maskRepeat = "no-repeat, no-repeat";
  const maskSize = "100% 100%, 100% 100%";
  const maskStyle: React.CSSProperties = {
    borderRadius,
    padding: `${borderWidthPx}px`,
    WebkitMaskImage: maskImage,
    maskImage,
    WebkitMaskOrigin: maskOrigin,
    maskOrigin,
    WebkitMaskRepeat: maskRepeat,
    maskRepeat,
    WebkitMaskSize: maskSize,
    maskSize,
    WebkitMaskComposite: "xor" as unknown as React.CSSProperties["WebkitMaskComposite"],
    maskComposite: "exclude",
  };

  return (
    <div
      ref={wrapperRef}
      aria-hidden
      className="pointer-events-none absolute inset-0"
      style={maskStyle}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
        aria-hidden
      >
        <rect ref={pathRef} fill="none" width="100%" height="100%" rx="22" ry="22" />
      </svg>
      <div
        ref={blobRef}
        className={cn(
          "absolute top-0 left-0 rounded-full",
          "bg-[radial-gradient(circle,rgba(186,230,253,1)_0%,rgba(125,211,252,0.95)_22%,rgba(168,85,247,0.92)_44%,rgba(236,72,153,0.85)_62%,rgba(236,72,153,0)_78%)]",
          blobClassName
        )}
        style={{ width: `${blobSizePx}px`, height: `${blobSizePx}px` }}
      />
    </div>
  );
}
