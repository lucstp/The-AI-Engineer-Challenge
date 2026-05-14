import { useCallback, useEffect, useRef, useState } from "react";

import { ChatApiError, streamChatMessage } from "@/lib/chat-client";
import { createAssistantMessage, createUserMessage } from "@/lib/chat-state";
import type { ChatMessage } from "@/lib/chat-types";

export interface ChatStreaming {
  isLoading: boolean;
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  errorMessage: string | null;
  setErrorMessage: React.Dispatch<React.SetStateAction<string | null>>;
  requestStopped: boolean;
  setRequestStopped: React.Dispatch<React.SetStateAction<boolean>>;
  activeRequestRef: React.RefObject<AbortController | null>;
  submitMessage: (messageText: string) => Promise<void>;
  stopCurrentRequest: () => void;
}

interface UseChatStreamingArgs {
  isChatLocked: boolean;
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  setInputValue: React.Dispatch<React.SetStateAction<string>>;
}

/**
 * Owns the chat-streaming lifecycle — abort controller, loading flag,
 * error state, and the submitMessage / stopCurrentRequest handlers.
 * Aborts in-flight on unmount.
 */
export function useChatStreaming({
  isChatLocked,
  setMessages,
  setInputValue,
}: UseChatStreamingArgs): ChatStreaming {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [requestStopped, setRequestStopped] = useState(false);
  const activeRequestRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      activeRequestRef.current?.abort();
    };
  }, []);

  const submitMessage = useCallback(
    async (messageText: string) => {
      const trimmed = messageText.trim();
      if (!trimmed || isLoading || isChatLocked) {
        return;
      }

      activeRequestRef.current?.abort();
      const controller = new AbortController();
      activeRequestRef.current = controller;

      const userMessage = createUserMessage(trimmed);
      const assistantMessage = createAssistantMessage("", { animate: false });
      const assistantMessageId = assistantMessage.id;
      let receivedChunk = false;

      setMessages((prev) => [...prev, userMessage, assistantMessage]);
      setInputValue("");
      setIsLoading(true);
      setErrorMessage(null);
      setRequestStopped(false);

      try {
        await streamChatMessage(trimmed, {
          signal: controller.signal,
          onChunk: (chunk) => {
            receivedChunk = true;
            setMessages((prev) =>
              prev.map((message) =>
                message.id === assistantMessageId
                  ? { ...message, content: `${message.content}${chunk}` }
                  : message
              )
            );
          },
        });

        if (!receivedChunk) {
          throw new ChatApiError("The assistant returned an empty response.");
        }
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }
        const fallback = "Unable to connect to OpenAI right now. Please try again in a moment.";
        const detail = error instanceof Error ? error.message : fallback;
        if (!receivedChunk) {
          setMessages((prev) => prev.filter((message) => message.id !== assistantMessageId));
        }
        setErrorMessage(detail || fallback);
      } finally {
        if (activeRequestRef.current === controller) {
          activeRequestRef.current = null;
        }
        setIsLoading(false);
      }
    },
    [isLoading, isChatLocked, setMessages, setInputValue]
  );

  const stopCurrentRequest = useCallback(() => {
    if (!activeRequestRef.current) {
      return;
    }
    activeRequestRef.current.abort();
    activeRequestRef.current = null;
    setIsLoading(false);
    setRequestStopped(true);
  }, []);

  return {
    isLoading,
    setIsLoading,
    errorMessage,
    setErrorMessage,
    requestStopped,
    setRequestStopped,
    activeRequestRef,
    submitMessage,
    stopCurrentRequest,
  };
}
