"use client";

import type { RefObject } from "react";

import { ChatComposer } from "@/components/chat/chat-composer";
import { MessageList } from "@/components/chat/message-list";
import type { ChatMessage } from "@/lib/chat-types";
import { cn } from "@/lib/utils";

interface ChatPanelProps {
  messages: ChatMessage[];
  isLoading: boolean;
  isChatLocked: boolean;
  isRestoringChatState: boolean;
  isSwappingPanel: boolean;
  /**
   * True on the very first render only — gates `panel-enter` so the
   * panel is static on initial paint and only animates on the verified
   * ↔ locked transition. Flipped by a post-mount `useState` in ChatShell.
   */
  isInitialPaint: boolean;
  errorMessage: string | null;
  conversationContainerRef: RefObject<HTMLElement | null>;
  endOfMessagesRef: RefObject<HTMLDivElement | null>;
  onConversationScroll: (scrollTop: number) => void;
  onAnimationDone: (messageId: string) => void;
  onDismissError: () => void;
  /** Re-send the last user message after an error. Optional — if absent,
   * the Retry button isn't rendered (e.g. before any submission has happened). */
  onRetryLastMessage?: () => void;
  onChooseExamplePrompt: (prompt: string) => void;
  inputValue: string;
  onInputChange: (value: string) => void;
  onSubmitMessage: () => void;
  onStopRequest: () => void;
}

/**
 * Unlocked-state chat content — message list + composer, wrapped together
 * so they fade in/out as a unit via panel-enter / panel-exit. Mounted only
 * when `isApiKeyVerified === true`; unmounted (panel-exit completing first)
 * on disconnect.
 */
export function ChatPanel({
  messages,
  isLoading,
  isChatLocked,
  isRestoringChatState,
  isSwappingPanel,
  isInitialPaint,
  errorMessage,
  conversationContainerRef,
  endOfMessagesRef,
  onConversationScroll,
  onAnimationDone,
  onDismissError,
  onRetryLastMessage,
  onChooseExamplePrompt,
  inputValue,
  onInputChange,
  onSubmitMessage,
  onStopRequest,
}: ChatPanelProps) {
  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col gap-3 sm:gap-4",
        isSwappingPanel ? "panel-exit" : isInitialPaint ? null : "panel-enter"
      )}
    >
      {isRestoringChatState ? (
        <section
          ref={conversationContainerRef}
          aria-live="polite"
          aria-label="Conversation"
          onScroll={(event) => {
            onConversationScroll(event.currentTarget.scrollTop);
          }}
          className={cn(
            "relative flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto rounded-xl p-3 sm:p-4",
            "bg-transparent!"
          )}
        >
          <div className="m-auto w-full max-w-[620px] p-4 text-center">
            <p className="m-0 text-slate-100/90 text-sm">Restoring conversation...</p>
          </div>
          <div ref={endOfMessagesRef} aria-hidden />
        </section>
      ) : (
        <MessageList
          messages={messages}
          isLoading={isLoading}
          isLocked={isChatLocked}
          errorMessage={errorMessage}
          conversationContainerRef={conversationContainerRef}
          onConversationScroll={onConversationScroll}
          onAnimationDone={onAnimationDone}
          onDismissError={onDismissError}
          onRetryLastMessage={onRetryLastMessage}
          onChooseExamplePrompt={onChooseExamplePrompt}
          endOfMessagesRef={endOfMessagesRef}
        />
      )}

      <ChatComposer
        value={inputValue}
        isLoading={isLoading}
        isDisabled={isChatLocked}
        onChange={onInputChange}
        onSubmit={onSubmitMessage}
        onStop={onStopRequest}
      />
    </div>
  );
}
