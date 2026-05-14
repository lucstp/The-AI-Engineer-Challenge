import { cookies } from "next/headers";

import { ChatShell } from "@/components/chat/chat-shell";
import { AuroraBackground } from "@/components/decoration/aurora-background";
import { LoveIsTheOnlyAnswer } from "@/components/decoration/love-is-the-only-answer";
import { DisclaimerFooter } from "@/components/layout/disclaimer-footer";
import { Hero } from "@/components/layout/hero";
import { isPlausibleOpenAiKey } from "@/lib/schemas";

const OPENAI_API_KEY_COOKIE = "openai_api_key";

export default async function HomePage() {
  // Raw cookie value — PR 7 (cookie security) wraps this with AES-256-GCM
  // seal/unseal so the cookie holds an opaque blob instead of the plaintext
  // key. For now we just sanity-check shape with the shared schema.
  const cookieStore = await cookies();
  const rawCookie = cookieStore.get(OPENAI_API_KEY_COOKIE)?.value;
  const initialIsApiKeyVerified =
    typeof rawCookie === "string" && isPlausibleOpenAiKey(rawCookie);

  return (
    <main
      id="main-content"
      className="relative isolate min-h-svh overflow-y-auto overflow-x-hidden px-3 py-5 sm:px-4 sm:py-6 lg:h-svh lg:min-h-0 lg:overflow-hidden lg:px-8 lg:py-8 xl:px-10 xl:py-10"
    >
      {/* Two "Love is the only answer" handwritten epigraphs frame the chat
          shell diagonally: upper-left + middle-right. Hidden below lg. */}
      <LoveIsTheOnlyAnswer className="pointer-events-none absolute top-[18%] left-4 z-0 hidden w-[180px] opacity-85 lg:block xl:top-[27%] xl:left-10 xl:w-[220px] 2xl:left-72 2xl:w-[320px]" />
      <LoveIsTheOnlyAnswer className="pointer-events-none absolute top-1/2 right-4 z-0 hidden w-[220px] -translate-y-1/2 opacity-85 lg:block xl:right-12 xl:w-[280px] 2xl:right-60 2xl:w-[320px]" />

      <AuroraBackground />

      <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-4 lg:h-full lg:justify-center">
        <Hero />
        <ChatShell initialIsApiKeyVerified={initialIsApiKeyVerified} />
        <DisclaimerFooter />
      </div>
    </main>
  );
}
