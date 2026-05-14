import { cookies } from "next/headers";

import { ChatShell } from "@/components/chat/chat-shell";
import { AuroraBackground } from "@/components/decoration/aurora-background";
import { LoveIsTheOnlyAnswer } from "@/components/decoration/love-is-the-only-answer";
import { DisclaimerFooter } from "@/components/layout/disclaimer-footer";
import { Hero } from "@/components/layout/hero";
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
      className="relative isolate min-h-svh overflow-y-auto overflow-x-hidden px-3 py-5 sm:px-4 sm:py-6 lg:h-svh lg:min-h-0 lg:overflow-hidden lg:px-8 lg:py-8 xl:px-10 xl:py-10"
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
      <LoveIsTheOnlyAnswer className="pointer-events-none absolute top-[18%] z-0 hidden w-[220px] opacity-90 2xl:block 2xl:right-[calc(50%_+_540px)] min-[1800px]:top-[22%] min-[1800px]:w-[260px]" />
      <LoveIsTheOnlyAnswer className="pointer-events-none absolute top-1/2 z-0 hidden w-[220px] -translate-y-1/2 opacity-90 2xl:block 2xl:left-[calc(50%_+_540px)] min-[1800px]:w-[260px]" />

      <AuroraBackground />

      {/* Layout root — CSS in globals.css reads `body[data-chat-locked]`
          (set by useEffect in ChatShell) and switches flex behavior:
          locked → justify-content: center (whole content block centers
          vertically); unlocked → disclaimer wrapper gets mt-auto so the
          chat shell expands at top and the footer pins to bottom. */}
      <div
        data-layout-root
        className="mx-auto flex w-full max-w-[1320px] flex-col gap-4 lg:h-full"
      >
        <Hero />
        <ChatShell initialIsApiKeyVerified={initialIsApiKeyVerified} />
        <div data-disclaimer-wrapper>
          <DisclaimerFooter />
        </div>
      </div>
    </main>
  );
}
