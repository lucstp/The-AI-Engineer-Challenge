import { useEffect, useRef } from "react";

import type { ChatMessage } from "@/lib/chat-types";

interface UseChatScrollArgs {
  messages: ChatMessage[];
  isLoading: boolean;
  isRestoringChatState: boolean;
  conversationContainerRef: React.RefObject<HTMLElement | null>;
  endOfMessagesRef: React.RefObject<HTMLDivElement | null>;
  /** Set by useChatPersistence on mount if there's a stored scroll position. */
  pendingRestoredScrollTopRef: React.RefObject<number | null>;
}

/**
 * Manages chat scroll behavior:
 *  - On first paint after restore, jumps to the stored scroll position
 *  - Otherwise, smooth-scrolls to bottom when new messages arrive or
 *    when streaming activity (isLoading) starts
 */
export function useChatScroll({
  messages,
  isLoading,
  isRestoringChatState,
  conversationContainerRef,
  endOfMessagesRef,
  pendingRestoredScrollTopRef,
}: UseChatScrollArgs): void {
  const lastMessageCountRef = useRef(0);

  useEffect(() => {
    if (isRestoringChatState) {
      return;
    }
    if (pendingRestoredScrollTopRef.current !== null) {
      const scrollTop = pendingRestoredScrollTopRef.current;
      const conversationContainer = conversationContainerRef.current;
      if (conversationContainer) {
        requestAnimationFrame(() => {
          conversationContainer.scrollTop = scrollTop;
        });
      }
      pendingRestoredScrollTopRef.current = null;
      return;
    }
    const hasNewMessage = messages.length > lastMessageCountRef.current;
    lastMessageCountRef.current = messages.length;
    if (!hasNewMessage && !isLoading) {
      return;
    }
    endOfMessagesRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [
    messages,
    isLoading,
    isRestoringChatState,
    conversationContainerRef,
    endOfMessagesRef,
    pendingRestoredScrollTopRef,
  ]);
}
