/**
 * Page footer — rainbow Coldplay wordmark sitting on plain page background,
 * legal disclaimer beneath, separate licensed audio credits, and closing
 * gradient hairline.
 */
export function DisclaimerFooter() {
  return (
    <footer className="mx-auto w-full max-w-[7xl] px-3 pt-2">
      <div className="flex flex-col items-center gap-3">
        {/* Intrinsic dims passed explicitly so the browser reserves the
            aspect-ratio box before load → zero CLS, passes Lighthouse
            unsized-images audit. CSS sizing (h-8/9/10 w-auto) still
            controls actual rendered size. */}
        <img
          src="/mm-logo1_copy.webp"
          alt="Coldplay"
          width={250}
          height={44}
          loading="lazy"
          decoding="async"
          className="h-8 w-auto opacity-95 sm:h-9 lg:h-10"
        />

        <p className="m-0 max-w-5xl text-center text-white/80 text-xs leading-relaxed [text-shadow:0_1px_2px_rgba(0,0,0,0.5)] sm:text-[0.78rem] lg:text-[0.82rem]">
          <span className="font-bold text-lime-300 uppercase tracking-[0.18em] [text-shadow:0_0_10px_rgba(190,242,100,0.45)]">
            Disclaimer
          </span>
          <span className="mx-2 text-white/40">·</span>
          This is a non-commercial student project created for educational purposes only. All
          trademarks, logos, song titles, artist names, and brand names are the property of their
          respective owners. Use of the Coldplay name is intended only to describe the subject of
          this project and does not imply any affiliation with or endorsement by Coldplay,
          Parlophone, Warner Music Group, or Live Nation. No original Coldplay recordings, stems,
          vocals, or copyrighted musical excerpts are used. Background music and sound effects are
          licensed from third-party royalty-free libraries and are not affiliated with Coldplay.
        </p>

        <div className="gradient-hairline my-3 w-full max-w-[640px]" aria-hidden />
        <p className="m-0 max-w-[824px] text-center text-[0.68rem] text-white/55 leading-relaxed [text-shadow:0_1px_2px_rgba(0,0,0,0.45)] sm:text-xs">
          <span className="font-bold text-cyan-200 uppercase tracking-[0.16em]">Audio Credits</span>
          <span className="mx-2 text-white/35">·</span>
          Music: “Aerophonia” by TangerineMedia / Pond5, used under Pond5 license. Sound effects:
          stadium crowd sound effect, used under its respective license.
        </p>
      </div>
    </footer>
  );
}
