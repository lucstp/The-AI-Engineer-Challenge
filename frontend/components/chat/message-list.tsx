import { Sparkles, User } from "lucide-react";
import { lazy, type RefObject, Suspense } from "react";
import { TypewriterText } from "@/components/chat/typewriter-text";
import { Button } from "@/components/ui/button";
import type { ChatMessage } from "@/lib/chat-types";
import { fireOnUserAction } from "@/lib/confetti";
import { cn } from "@/lib/utils";

// Lazy-load the markdown renderer so `react-markdown` + `remark-gfm`
// (~35-45 KB gzipped combined) don't ship in the initial JS bundle.
// The locked landing page never renders a markdown message, so first-
// time visitors download zero markdown JS until they actually unlock
// the chat AND receive an assistant response. Per Next.js lazy-loading
// docs + React.lazy docs — the imported module must use `export default`
// (see `markdown-message.tsx`).
const MarkdownMessage = lazy(() => import("./markdown-message"));

const EXAMPLE_PROMPTS = [
  "Who are the members of Coldplay and what does each one do?",
  "Give me a concise timeline of Coldplay albums.",
  "What is the concept behind Moon Music?",
];

interface MessageListProps {
  messages: ChatMessage[];
  isLoading: boolean;
  isLocked: boolean;
  /**
   * True during the initial sessionStorage restore (first paint until
   * the `useLayoutEffect` in `useChatPersistence` completes). Owned at
   * `ChatPanel`, passed in so the OUTER `<section>` persists across the
   * restoring → restored transition. The inner content (messages,
   * prompts, hero, thinking dots, error) is rendered only post-restore
   * — that keeps React from unmounting and remounting two different
   * subtrees, which was producing the visible disappear/reappear
   * flicker (especially under React Strict Mode's dev-only double
   * mount).
   */
  isRestoring: boolean;
  errorMessage: string | null;
  conversationContainerRef: RefObject<HTMLElement | null>;
  onConversationScroll: (scrollTop: number) => void;
  onAnimationDone: (messageId: string) => void;
  onDismissError: () => void;
  /** Re-send the last user message after an error. When provided, a Retry
   * button renders alongside Dismiss so the user can recover in one click. */
  onRetryLastMessage?: () => void;
  onChooseExamplePrompt: (prompt: string) => void;
  endOfMessagesRef: RefObject<HTMLDivElement | null>;
}

function formatMessageTime(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(timestamp);
}

export function MessageList({
  messages,
  isLoading,
  isLocked,
  isRestoring,
  errorMessage,
  conversationContainerRef,
  onConversationScroll,
  onAnimationDone,
  onDismissError,
  onRetryLastMessage,
  onChooseExamplePrompt,
  endOfMessagesRef,
}: MessageListProps) {
  const hasMessages = messages.length > 0;
  const hasUserMessages = messages.some((message) => message.role === "user");
  const latestAssistantMessage = [...messages]
    .reverse()
    .find((message) => message.role === "assistant");
  const shouldShowThinkingDots =
    isLoading && (!latestAssistantMessage || latestAssistantMessage.content.trim().length === 0);
  const shouldShowBottomPrompts = !isLocked && hasMessages && !hasUserMessages;
  const visibleMessages = messages.filter(
    (message) => !(isLoading && message.role === "assistant" && message.content.trim().length === 0)
  );

  return (
    <section
      ref={conversationContainerRef}
      aria-live="polite"
      aria-label="Conversation"
      onScroll={(event) => {
        onConversationScroll(event.currentTarget.scrollTop);
      }}
      className={cn(
        "conversation-surface chat-scrollbar relative flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto rounded-2xl p-3 sm:p-4"
      )}
    >
      {isRestoring ? null : (
        <>
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {isLocked ? null : !hasMessages ? (
              <li className="flex justify-center">
                <div className="m-auto w-full max-w-[780px] p-3 text-center">
                  <h2 className="m-0 mb-3 font-black text-2xl text-white leading-tight tracking-normal sm:text-3xl">
                    Ask Coldplay anything
                  </h2>
                  <p className="mx-auto mb-7 max-w-[54ch] font-medium text-cyan-50/90 text-sm leading-relaxed sm:text-base">
                    Start with a prompt or write your own question about songs, albums, eras, tours,
                    members, and official releases.
                  </p>
                  <div className="mx-auto mt-4 grid w-full max-w-[920px] grid-cols-1 gap-3 text-left sm:grid-cols-2 lg:grid-cols-3">
                    {EXAMPLE_PROMPTS.map((prompt) => (
                      <Button
                        key={prompt}
                        type="button"
                        variant="ghost"
                        size="default"
                        onClick={() => {
                          fireOnUserAction();
                          onChooseExamplePrompt(prompt);
                        }}
                        className="prompt-glass h-auto min-h-14 justify-start whitespace-normal rounded-2xl border-cyan-200/35 bg-linear-to-br from-white/12 via-cyan-200/12 to-fuchsia-200/12 px-5 py-3 pl-6 font-medium text-cyan-50 text-sm leading-relaxed shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_0_0_1px_rgba(186,230,253,0.16),0_0_24px_-8px_rgba(125,249,255,0.25)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-cyan-200/55 hover:bg-linear-to-br hover:from-cyan-200/18 hover:via-violet-300/16 hover:to-fuchsia-300/18 hover:text-white hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.5),0_0_0_1px_rgba(186,230,253,0.32),0_0_36px_-8px_rgba(125,249,255,0.45),0_0_60px_-12px_rgba(167,139,250,0.35)]"
                      >
                        {prompt}
                      </Button>
                    ))}
                  </div>
                </div>
              </li>
            ) : (
              visibleMessages.map((message) => (
                <li
                  key={message.id}
                  className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}
                >
                  {message.role === "user" ? (
                    <article
                      aria-label="Your message"
                      className="flex w-full max-w-[92%] items-start justify-end gap-3 leading-relaxed sm:max-w-[86%]"
                    >
                      <div className="flex flex-col items-end gap-1.5 whitespace-pre-wrap text-right">
                        <div className="flex items-baseline gap-2">
                          <span className="font-normal text-base text-white leading-none tracking-tight">
                            You
                          </span>
                          <time
                            className="font-normal text-sm text-white/72 leading-none"
                            dateTime={new Date(message.createdAt).toISOString()}
                          >
                            {formatMessageTime(message.createdAt)}
                          </time>
                        </div>
                        <div className="px-0 py-1 font-light text-[rgba(253,224,71,1)] text-base leading-7">
                          <p className="m-0">{message.content}</p>
                        </div>
                      </div>
                      {/* User avatar — mirrors the assistant's Sparkles avatar
                      (rounded-full, same dims, same shadow stack) but with
                      a warmer fuchsia → violet → amber palette so the two
                      bubbles contrast visually. Lives on the RIGHT side of
                      the user row. */}
                      <span
                        className="ai-avatar-aurora inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/28 bg-linear-to-br from-fuchsia-300/35 via-violet-300/26 to-amber-200/35 text-amber-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_10px_22px_-14px_rgba(2,6,23,0.95)]"
                        aria-hidden
                      >
                        <User className="h-4 w-4" />
                      </span>
                    </article>
                  ) : (
                    <article
                      aria-label="Assistant message"
                      className="flex w-full max-w-[72ch] items-start gap-3 leading-relaxed"
                    >
                      <span
                        className="ai-avatar-aurora inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/28 bg-linear-to-br from-cyan-300/30 via-violet-300/26 to-fuchsia-300/35 text-cyan-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_10px_22px_-14px_rgba(2,6,23,0.95)]"
                        aria-hidden
                      >
                        <Sparkles className="h-4 w-4" />
                      </span>
                      <div className="flex flex-col items-start gap-1.5">
                        <div className="flex items-baseline gap-2">
                          <span className="font-normal text-base text-white leading-none tracking-tight">
                            Coldplay AI
                          </span>
                          <time
                            className="font-normal text-sm text-white/72 leading-none"
                            dateTime={new Date(message.createdAt).toISOString()}
                          >
                            {formatMessageTime(message.createdAt)}
                          </time>
                        </div>
                        <div className="px-0 py-1 font-light text-base text-cyan-200 leading-7 [text-shadow:0_1px_2px_rgba(2,8,28,0.15)]">
                          {message.animate ? (
                            <p className="m-0 whitespace-pre-wrap">
                              <TypewriterText
                                text={message.content}
                                animate
                                durationMs={message.typingMs}
                                onAnimationDone={() => onAnimationDone(message.id)}
                              />
                            </p>
                          ) : (
                            // Fallback renders the same raw text — CLS-safe
                            // because the unformatted paragraph occupies the
                            // same vertical footprint as the formatted output
                            // for the ~50-150ms before the markdown chunk
                            // hydrates. `whitespace-pre-wrap` preserves any
                            // newlines so the visual layout is essentially
                            // identical pre/post hydration.
                            <Suspense
                              fallback={
                                <p className="m-0 whitespace-pre-wrap">{message.content}</p>
                              }
                            >
                              <MarkdownMessage content={message.content} />
                            </Suspense>
                          )}
                        </div>
                      </div>
                    </article>
                  )}
                </li>
              ))
            )}
          </ul>

          {shouldShowBottomPrompts ? (
            <div className="mt-auto pt-2">
              <div className="mx-auto grid w-full max-w-[920px] grid-cols-1 gap-3 text-left sm:grid-cols-2 lg:grid-cols-3">
                {EXAMPLE_PROMPTS.map((prompt) => (
                  <Button
                    key={prompt}
                    type="button"
                    variant="ghost"
                    size="default"
                    onClick={() => {
                      fireOnUserAction();
                      onChooseExamplePrompt(prompt);
                    }}
                    className="prompt-glass h-auto min-h-14 justify-start whitespace-normal rounded-2xl border-cyan-200/35 bg-linear-to-br from-white/12 via-cyan-200/12 to-fuchsia-200/12 px-5 py-3 pl-6 font-medium text-cyan-50 text-sm leading-relaxed shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_0_0_1px_rgba(186,230,253,0.16),0_0_24px_-8px_rgba(125,249,255,0.25)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-cyan-200/55 hover:bg-linear-to-br hover:from-cyan-200/18 hover:via-violet-300/16 hover:to-fuchsia-300/18 hover:text-white hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.5),0_0_0_1px_rgba(186,230,253,0.32),0_0_36px_-8px_rgba(125,249,255,0.45),0_0_60px_-12px_rgba(167,139,250,0.35)]"
                  >
                    {prompt}
                  </Button>
                ))}
              </div>
            </div>
          ) : null}

          {shouldShowThinkingDots ? (
            <article aria-label="Assistant thinking" className="self-start">
              <div className="flex items-center gap-2 px-0 py-1 text-cyan-50">
                <Sparkles className="h-4 w-4 text-cyan-100/90" aria-hidden />
                <p className="m-0 inline-flex items-center gap-1.5">
                  <span className="thinking-dot" />
                  <span className="thinking-dot" />
                  <span className="thinking-dot" />
                </p>
              </div>
            </article>
          ) : null}

          {errorMessage ? (
            <div
              role="alert"
              className="flex flex-col items-start justify-between gap-2 rounded-xl border border-rose-200/45 bg-rose-950/50 px-3 py-2 text-rose-50 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-md sm:flex-row sm:items-center sm:gap-3"
            >
              <span>{errorMessage}</span>
              <div className="flex gap-2 self-end sm:self-auto">
                {onRetryLastMessage ? (
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    onClick={() => {
                      onDismissError();
                      onRetryLastMessage();
                    }}
                  >
                    Retry
                  </Button>
                ) : null}
                <Button type="button" variant="outline" size="sm" onClick={onDismissError}>
                  Dismiss
                </Button>
              </div>
            </div>
          ) : null}
        </>
      )}

      <div ref={endOfMessagesRef} aria-hidden />
    </section>
  );
}
