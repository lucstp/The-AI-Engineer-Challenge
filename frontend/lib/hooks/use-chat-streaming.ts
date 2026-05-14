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
  /** Retry the last user message after an error. Does NOT add a second user
   * turn — the original user message is already in the array from the
   * original failed submission. */
  retryLastMessage: () => Promise<void>;
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
  // Last user message text — captured on every submit so Retry can re-send
  // it without requiring the user to retype after a transient OpenAI error.
  const lastUserMessageRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      activeRequestRef.current?.abort();
    };
  }, []);

  const runRequest = useCallback(
    async (messageText: string, isRetry: boolean) => {
      const trimmed = messageText.trim();
      if (!trimmed || isLoading || isChatLocked) {
        return;
      }

      activeRequestRef.current?.abort();
      const controller = new AbortController();
      activeRequestRef.current = controller;

      const assistantMessage = createAssistantMessage("", { animate: false });
      const assistantMessageId = assistantMessage.id;
      let receivedChunk = false;

      if (isRetry) {
        // Retry path: the user's original message is already in the messages
        // array from the prior failed submission — only add a fresh assistant
        // placeholder. Don't clear inputValue (user may have typed something
        // new in the box and we don't want to nuke it).
        setMessages((prev) => [...prev, assistantMessage]);
      } else {
        const userMessage = createUserMessage(trimmed);
        setMessages((prev) => [...prev, userMessage, assistantMessage]);
        setInputValue("");
        lastUserMessageRef.current = trimmed;
      }

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

  const submitMessage = useCallback(
    (messageText: string) => runRequest(messageText, false),
    [runRequest]
  );

  const retryLastMessage = useCallback(async () => {
    const last = lastUserMessageRef.current;
    if (last !== null) {
      await runRequest(last, true);
    }
  }, [runRequest]);

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
    retryLastMessage,
  };
}
