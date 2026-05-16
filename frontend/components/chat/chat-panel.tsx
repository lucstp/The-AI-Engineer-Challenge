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
   * True only while this panel is freshly mounted as the result of a
   * locked ↔ verified TRANSITION. False on initial paint (cold page
   * load / refresh of an already-verified session) so the panel
   * appears static — no entry animation, no opacity-0→1 flash that
   * would briefly hide the welcome text, prompts, and composer. Owned
   * by ChatShell via a set-state-during-render gate; cleared 260ms
   * after the transition completes.
   */
  isEntering: boolean;
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
  isEntering,
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
        isSwappingPanel ? "panel-exit" : isEntering ? "panel-enter" : null
      )}
    >
      {/* Single persistent <section> across the restoring → restored
          transition. Previously we rendered TWO different subtrees
          (`<section>Restoring conversation...</section>` vs
          `<MessageList>`), which React reconciled as unmount-then-mount
          — producing a visible content swap and amplified by React
          Strict Mode's dev-only mount→unmount→remount cycle into the
          "messages and prompts disappear then reappear" flicker the
          user reported. Passing `isRestoring` into MessageList lets the
          outer DOM persist; only the inner content transitions from
          null → populated. */}
      <MessageList
        messages={messages}
        isLoading={isLoading}
        isLocked={isChatLocked}
        isRestoring={isRestoringChatState}
        errorMessage={errorMessage}
        conversationContainerRef={conversationContainerRef}
        onConversationScroll={onConversationScroll}
        onAnimationDone={onAnimationDone}
        onDismissError={onDismissError}
        onRetryLastMessage={onRetryLastMessage}
        onChooseExamplePrompt={onChooseExamplePrompt}
        endOfMessagesRef={endOfMessagesRef}
      />

      <ChatComposer
        value={inputValue}
        isLoading={isLoading}
        isDisabled={isChatLocked}
        onChange={onInputChange}
        onSubmit={onSubmitMessage}
        onStop={onStopRequest}
      />

      {/* Pond5 audio attribution — minimal-footprint, always-visible legal
          credit, rendered BELOW the composer so it reads as meta/footer
          rather than competing with the primary action. The locked-state
          <DisclaimerFooter> contains the full credit; this in-chat line
          keeps the Pond5 attribution visible at all times during the
          chat experience (license requirement). */}
      <p className="m-0 px-3 text-center text-[0.6rem] text-white/40 italic leading-tight [text-shadow:0_1px_2px_rgba(0,0,0,0.4)] sm:text-[0.65rem]">
        Music: “Aerophonia” by TangerineMedia · Pond5
      </p>
    </div>
  );
}
