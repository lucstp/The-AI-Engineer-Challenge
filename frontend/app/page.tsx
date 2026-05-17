import { cookies } from "next/headers";

import { ChatShell } from "@/components/chat/chat-shell";
import { AuroraBackground } from "@/components/decoration/aurora-background";
import { HeartDoodle } from "@/components/decoration/heart-doodle";
import { LoveIsTheOnlyAnswer } from "@/components/decoration/love-is-the-only-answer";
import { DisclaimerFooter } from "@/components/layout/disclaimer-footer";
import { DisclaimerWrapper } from "@/components/layout/disclaimer-wrapper";
import { Hero } from "@/components/layout/hero";
import { HeroWrapper } from "@/components/layout/hero-wrapper";
import { LayoutRoot } from "@/components/layout/layout-root";
import { isPlausibleOpenAiKey } from "@/lib/schemas";
import { unseal } from "@/lib/session-crypto";

const OPENAI_API_KEY_COOKIE = "openai_api_key";

export default async function HomePage() {
  // Cookie is AES-256-GCM sealed. unseal() returns null on any tamper or
  // wrong-key failure, which we treat as "unverified" — fail closed.
  const cookieStore = await cookies();
  const sealedKey = cookieStore.get(OPENAI_API_KEY_COOKIE)?.value;
  const apiKey = typeof sealedKey === "string" ? unseal(sealedKey) : null;
  const initialIsApiKeyVerified = apiKey !== null && isPlausibleOpenAiKey(apiKey);

  return (
    <main
      id="main-content"
      className="relative isolate flex h-svh flex-col overflow-y-auto overflow-x-hidden px-3 py-5 sm:px-4 sm:py-6 lg:px-8 lg:py-8 xl:px-10 xl:py-10"
    >
      {/* "Love is the only answer" handwritten epigraphs flank the chat shell
          diagonally — upper-left + middle-right. Positioned with
          `calc(50% + 540px)` so they ABUT the chat shell's outer edges with
          a ~20px gap (chat shell max-width is 1040px at 2xl, half-width
          520px, plus 20px gap = 540px from viewport center). Right side
          mirrors using `left:` instead of `right:`. Same calc on both
          sides keeps them symmetrically anchored to the shell — they
          scale with viewport width without ever overlapping or drifting
          to the screen corners. Shown at 2xl+ (>=1536px); below that the
          shell consumes too much horizontal real estate to fit them. */}
      <LoveIsTheOnlyAnswer className="pointer-events-none absolute top-[18%] z-0 hidden w-60 opacity-90 2xl:right-[calc(50%+590px)] 2xl:block min-[1800px]:top-[22%] min-[1800px]:w-70" />
      <LoveIsTheOnlyAnswer className="pointer-events-none absolute top-[48%] z-0 hidden w-60 -translate-y-1/2 opacity-90 2xl:left-[calc(50%+590px)] 2xl:block min-[1800px]:w-80" />

      {/* Heart doodles — ambient warmth, confined to the TOP HALF of the
          viewport so they never land ON the crowd silhouette (which fills
          the bottom 55vh after key verification). Balanced 2 red + 1
          purple for color variety. Subtle rotations + low opacity keep
          them as accents, not focal elements. Hidden below md to avoid
          crowding on small screens. */}
      <HeartDoodle
        variant="purple"
        size={36}
        className="absolute top-[5%] right-[6%] z-10 hidden -rotate-12 opacity-80 md:block lg:top-[7%] lg:right-[8%]"
      />
      <HeartDoodle
        variant="red"
        size={40}
        className="absolute top-[10%] left-[6%] z-1 hidden rotate-6 opacity-85 lg:block"
      />
      <HeartDoodle
        variant="red"
        size={32}
        className="absolute top-[36%] right-[4%] z-10 hidden rotate-12 opacity-80 md:block"
      />

      <AuroraBackground />

      {/* Layout root + disclaimer wrapper are Client Components that own
          the page-layout lock state via React state + Context. Initial
          state is server-rendered from `initialIsApiKeyVerified`, so the
          locked/unlocked flex layout is correct on first paint with no
          hydration reflow and no dependency on a compiled CSS attribute
          selector (the prior approach drifted whenever Turbopack's
          incremental CSS compile fell behind the SSR markup). ChatShell
          subscribes to the same context and propagates verify/disconnect
          transitions through `useLockState().setIsChatLocked`. */}
      <LayoutRoot initialIsApiKeyVerified={initialIsApiKeyVerified}>
        <HeroWrapper>
          <Hero />
        </HeroWrapper>
        <ChatShell initialIsApiKeyVerified={initialIsApiKeyVerified} />
        <DisclaimerWrapper>
          <DisclaimerFooter />
        </DisclaimerWrapper>
      </LayoutRoot>
    </main>
  );
}
