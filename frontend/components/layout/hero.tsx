import { OrangeDoodleHeart, YellowDoodleHeart } from "@/components/decoration/doodle-hearts";

/**
 * Page hero — brand pill, headline with the "Coldplay" gradient word,
 * prism line signature, and subtitle flanked by yellow + orange doodle
 * hearts. Renders as Server Component (no interactivity).
 */
export function Hero() {
  return (
    <section
      aria-label="Introduction"
      className="hero-copy mx-auto flex w-full max-w-[1220px] flex-col items-center gap-2 px-3 py-2 text-center sm:gap-3 sm:px-6 lg:px-0"
    >
      <span className="aurora-pill inline-flex items-center rounded-full px-3 py-1 font-semibold text-[0.68rem] text-white uppercase tracking-[0.22em] sm:text-xs">
        Coldplay AI Companion
      </span>
      {/* h1 size tier: the big-jump (text-[4.65rem]) is gated to xl (≥1280)
          so 1024-wide laptops keep a comfortable text-5xl headline instead
          of crowding the chat card. Desktop 1440 is unaffected — it still
          sits in xl and renders the original 4.65rem nowrap heading. */}
      <h1 className="m-0 max-w-[14ch] text-balance font-medium text-4xl text-white tracking-[-0.04em] sm:text-5xl lg:max-w-none xl:whitespace-nowrap xl:text-[4.65rem] xl:leading-[1.06]">
        Explore the universe of{" "}
        <span className="inline-block bg-linear-to-r from-cyan-300 via-violet-400 to-fuchsia-400 bg-clip-text pb-1 text-transparent">
          Coldplay
        </span>
      </h1>
      <span className="prism-line" aria-hidden />
      <div className="mt-2 flex w-full items-center justify-center gap-2.5 sm:mt-3 sm:gap-3">
        <YellowDoodleHeart className="h-5 w-[18px] shrink-0 -rotate-12 sm:h-6 sm:w-[22px] lg:h-7 lg:w-[26px]" />
        <p className="m-0 max-w-[58ch] text-pretty font-medium text-sm text-white italic leading-relaxed [text-shadow:0_1px_2px_rgba(0,0,0,0.4)] sm:text-base lg:max-w-none xl:whitespace-nowrap xl:text-[1.05rem]">
          Your AI companion for songs, albums, eras, members, live shows, and everything in between.
        </p>
        <OrangeDoodleHeart className="h-5 w-[18px] shrink-0 rotate-12 sm:h-6 sm:w-[22px] lg:h-7 lg:w-[26px]" />
      </div>
    </section>
  );
}
