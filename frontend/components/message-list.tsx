import { RefObject } from "react";

import { Button } from "@/components/ui/button";
import { TypewriterText } from "@/components/typewriter-text";
import { ChatMessage } from "@/lib/chat-types";
import { cn } from "@/lib/utils";

const EXAMPLE_PROMPTS = [
  "Who are the members of Coldplay and what does each one do?",
  "Give me a concise timeline of Coldplay albums.",
  "What is the concept behind Moon Music?"
];

interface MessageListProps {
  messages: ChatMessage[];
  isLoading: boolean;
  isLocked: boolean;
  errorMessage: string | null;
  onAnimationDone: (messageId: string) => void;
  onDismissError: () => void;
  onChooseExamplePrompt: (prompt: string) => void;
  endOfMessagesRef: RefObject<HTMLDivElement | null>;
}

export function MessageList({
  messages,
  isLoading,
  isLocked,
  errorMessage,
  onAnimationDone,
  onDismissError,
  onChooseExamplePrompt,
  endOfMessagesRef
}: MessageListProps) {
  const hasMessages = messages.length > 0;

  return (
    <section
      aria-live="polite"
      aria-label="Conversation"
      className={cn(
        "relative flex min-h-0 flex-col gap-3 overflow-y-auto rounded-xl p-3 sm:p-4",
        // Nested inside the glass Card; keep this surface lighter so the two
        // glass layers do not fight. Soft inset top highlight only.
        "border border-white/15 bg-white/[0.04]",
        "shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]"
      )}
    >
      {isLocked && !hasMessages ? (
        <div
          role="note"
          className="m-auto flex w-full max-w-[480px] flex-col items-center justify-center gap-2 rounded-lg border border-amber-300/40 bg-slate-950/55 p-5 text-center backdrop-blur-md"
        >
          <p className="m-0 text-base font-bold text-white sm:text-lg">
            Verify your OpenAI key to begin
          </p>
          <p className="m-0 text-sm text-slate-200">
            Enter your key in the panel above to unlock the chat input and example prompts.
          </p>
        </div>
      ) : !hasMessages ? (
        <div className="m-auto w-full max-w-[620px] p-4 text-center">
          <h2 className="m-0 mb-2 bg-gradient-to-br from-amber-300 via-rose-300 to-sky-300 bg-clip-text text-xl font-extrabold tracking-tight text-transparent sm:text-2xl">
            Your Coldplay knowledge space is ready
          </h2>
          <p className="mx-auto mb-4 max-w-[52ch] text-sm text-slate-200 sm:text-base">
            Ask about songs, albums, eras, tours, members, and official releases. This assistant is
            scoped for Coldplay-only chat.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2" aria-label="Example prompts">
            {EXAMPLE_PROMPTS.map((prompt) => (
              <Button
                key={prompt}
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => onChooseExamplePrompt(prompt)}
              >
                {prompt}
              </Button>
            ))}
          </div>
        </div>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {messages.map((message) => (
            <li
              key={message.id}
              className={cn(
                "flex",
                message.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              <article
                aria-label={message.role === "user" ? "Your message" : "Assistant message"}
                className={cn(
                  "max-w-[88%] whitespace-pre-wrap leading-relaxed",
                  message.role === "user"
                    ? "rounded-2xl border border-amber-200/50 bg-gradient-to-br from-amber-400/85 to-rose-400/65 px-4 py-2.5 text-stone-900 shadow-md font-medium"
                    : "max-w-[95%] text-slate-100"
                )}
              >
                <p className="m-0">
                  {message.role === "assistant" && message.animate ? (
                    <TypewriterText
                      text={message.content}
                      animate
                      onAnimationDone={() => onAnimationDone(message.id)}
                    />
                  ) : (
                    message.content
                  )}
                </p>
              </article>
            </li>
          ))}
        </ul>
      )}

      {isLoading ? (
        <article aria-label="Assistant thinking" className="self-start text-slate-100">
          <p className="m-0 inline-flex items-center gap-1.5">
            <span className="thinking-dot" />
            <span className="thinking-dot" />
            <span className="thinking-dot" />
          </p>
        </article>
      ) : null}

      {errorMessage ? (
        <div
          role="alert"
          className="flex flex-col items-start justify-between gap-2 rounded-md border border-rose-300/50 bg-rose-900/40 px-3 py-2 text-sm text-rose-100 sm:flex-row sm:items-center sm:gap-3"
        >
          <span>{errorMessage}</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onDismissError}
            className="self-end sm:self-auto"
          >
            Dismiss
          </Button>
        </div>
      ) : null}

      <div ref={endOfMessagesRef} aria-hidden />
    </section>
  );
}
