import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import type { ChatMessage, PersistedChatUiState } from "@/lib/chat-types";
import { persistedChatUiStateSchema } from "@/lib/schemas";

const CHAT_UI_STATE_STORAGE_KEY = "coldplay_chat_ui_state_v1";
const CHAT_SCROLL_TOP_STORAGE_KEY = "coldplay_chat_scroll_top_v1";

export interface ChatPersistence {
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  inputValue: string;
  setInputValue: React.Dispatch<React.SetStateAction<string>>;
  isRestoringChatState: boolean;
  conversationContainerRef: React.RefObject<HTMLElement | null>;
  endOfMessagesRef: React.RefObject<HTMLDivElement | null>;
  pendingRestoredScrollTopRef: React.RefObject<number | null>;
  handleConversationScroll: (scrollTop: number) => void;
  clearPersistedState: () => void;
}

/**
 * Owns the chat conversation state — messages, input draft, restoring flag.
 * Hydrates from sessionStorage on mount, persists on every change. Scroll
 * behavior is handled by `useChatScroll` (separate hook) using the refs
 * exposed here.
 */
export function useChatPersistence(): ChatPersistence {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isRestoringChatState, setIsRestoringChatState] = useState(true);
  const conversationContainerRef = useRef<HTMLElement | null>(null);
  const endOfMessagesRef = useRef<HTMLDivElement | null>(null);
  const pendingRestoredScrollTopRef = useRef<number | null>(null);

  // Restore on mount.
  useLayoutEffect(() => {
    try {
      const rawStoredState = window.sessionStorage.getItem(CHAT_UI_STATE_STORAGE_KEY);
      const rawStoredScrollTop = window.sessionStorage.getItem(CHAT_SCROLL_TOP_STORAGE_KEY);
      if (rawStoredState) {
        const raw = JSON.parse(rawStoredState);
        const parsedState = persistedChatUiStateSchema.safeParse(raw);
        if (parsedState.success) {
          const restoredMessages = parsedState.data.messages.map((message, index) => ({
            ...message,
            createdAt: Number.isFinite(message.createdAt) ? message.createdAt : Date.now() + index,
            animate: false,
          }));
          setMessages(restoredMessages);
          setInputValue(parsedState.data.inputValue);
        }
      }
      if (rawStoredScrollTop) {
        const parsedScrollTop = Number.parseInt(rawStoredScrollTop, 10);
        if (Number.isFinite(parsedScrollTop) && parsedScrollTop >= 0) {
          pendingRestoredScrollTopRef.current = parsedScrollTop;
        }
      }
    } catch {
      setMessages([]);
      setInputValue("");
    } finally {
      setIsRestoringChatState(false);
    }
  }, []);

  // Persist on every change.
  useEffect(() => {
    if (isRestoringChatState) {
      return;
    }
    const stateToPersist: PersistedChatUiState = { messages, inputValue };
    window.sessionStorage.setItem(CHAT_UI_STATE_STORAGE_KEY, JSON.stringify(stateToPersist));
  }, [messages, inputValue, isRestoringChatState]);

  const handleConversationScroll = useCallback(
    (scrollTop: number) => {
      if (isRestoringChatState) {
        return;
      }
      window.sessionStorage.setItem(
        CHAT_SCROLL_TOP_STORAGE_KEY,
        String(Math.max(0, Math.round(scrollTop)))
      );
    },
    [isRestoringChatState]
  );

  const clearPersistedState = useCallback(() => {
    window.sessionStorage.removeItem(CHAT_UI_STATE_STORAGE_KEY);
    window.sessionStorage.removeItem(CHAT_SCROLL_TOP_STORAGE_KEY);
  }, []);

  return {
    messages,
    setMessages,
    inputValue,
    setInputValue,
    isRestoringChatState,
    conversationContainerRef,
    endOfMessagesRef,
    pendingRestoredScrollTopRef,
    handleConversationScroll,
    clearPersistedState,
  };
}
