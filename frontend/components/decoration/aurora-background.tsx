/**
 * Coldplay Moon Music-style background graphics: two rainbow aurora SVG
 * layers anchored at the top-left and bottom-left of the viewport, each
 * animating with a staggered drift. Pure decorative chrome — `aria-hidden`.
 */

const BG_TOP_LEFT_URL =
  "https://www.coldplay.com/wp/wp-content/themes/coldplay-2024/dist/images/bg-top-left.webp";
const BG_BOTTOM_LEFT_URL =
  "https://www.coldplay.com/wp/wp-content/themes/coldplay-2024/dist/images/bg-bottom-left.webp";

export function AuroraBackground() {
  return (
    <div className="global-graphics" aria-hidden>
      <picture className="header__bg-img">
        <img src={BG_TOP_LEFT_URL} alt="" className="header__bg" decoding="async" loading="lazy" />
      </picture>
      <picture className="footer__bg-2-img">
        <img
          src={BG_BOTTOM_LEFT_URL}
          alt=""
          className="footer__bg"
          decoding="async"
          loading="lazy"
        />
      </picture>
    </div>
  );
}
