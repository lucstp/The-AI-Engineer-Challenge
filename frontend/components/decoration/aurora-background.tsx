import Image from "next/image";

/**
 * Coldplay Moon Music-style background graphics: two rainbow aurora WebP
 * layers anchored at the top-left and bottom-left of the viewport, each
 * animating with a staggered drift. Pure decorative chrome — `aria-hidden`.
 *
 * Provenance: the two source WebPs were originally produced by Coldplay
 * for their Moon Music marketing site (coldplay.com). They are
 * self-hosted in `public/decoration/` rather than hot-linked from
 * coldplay.com to (a) avoid breaking when the upstream CDN rotates URLs
 * and (b) get them through the Vercel image-optimization pipeline
 * (AVIF + WebP + responsive srcset). Their use here is covered by the
 * non-commercial educational fair-use posture documented in the
 * `<DisclaimerFooter>` — a temporary arrangement, not original work.
 *
 * Served via `next/image` so Vercel auto-converts to AVIF when the
 * browser's Accept header advertises it. `fill` lets each image
 * occupy the positioned-via-CSS container set by `.header__bg-img`,
 * `.footer__bg-img`, `.footer__bg-2-img` in `globals.css`.
 */
export function AuroraBackground() {
  return (
    <div className="global-graphics" aria-hidden>
      <picture className="header__bg-img">
        <Image
          src="/decoration/aurora-top-left.webp"
          alt=""
          fill
          sizes="100vw"
          quality={70}
          className="header__bg"
        />
      </picture>
      <picture className="footer__bg-2-img">
        <Image
          src="/decoration/aurora-bottom-left.webp"
          alt=""
          fill
          sizes="100vw"
          quality={70}
          className="footer__bg"
        />
      </picture>
      <picture className="footer__bg-img">
        <Image
          src="/decoration/aurora-bottom-left.webp"
          alt=""
          fill
          sizes="100vw"
          quality={70}
          className="footer__bg"
        />
      </picture>
    </div>
  );
}
