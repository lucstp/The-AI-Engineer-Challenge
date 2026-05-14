import { useEffect, useRef } from "react";

import { createAssistantMessage } from "@/lib/chat-state";
import type { ChatMessage } from "@/lib/chat-types";

// Trailing two spaces + \n is the markdown hard-break syntax — keeps the
// welcome on 3 distinct lines both during the typewriter animation (via
// whitespace-pre-wrap) and after, when ReactMarkdown takes over (which
// would otherwise collapse single \n into a space per markdown spec).
const WELCOME_MESSAGE =
  "Hello! I'm your Coldplay AI companion.  \nAsk me anything about songs, albums, lyrics, live shows, or the band's journey.  \nI'll do my best to help you explore their universe.";

const WELCOME_TYPING_MS = 2200;

interface UseWelcomeInjectionArgs {
  isApiKeyVerified: boolean;
  isRestoringChatState: boolean;
  setMessages: (updater: (prev: ChatMessage[]) => ChatMessage[]) => void;
}

/**
 * Re-injects an animated welcome message whenever validation succeeds AND
 * there is no user turn yet. Real conversations (with user messages)
 * persist as-is; a fresh validation always triggers the typewriter — even
 * if a stale static welcome was restored from sessionStorage.
 */
export function useWelcomeInjection({
  isApiKeyVerified,
  isRestoringChatState,
  setMessages,
}: UseWelcomeInjectionArgs): void {
  // Latch — flips true the first time we inject for the current verified
  // session, resets when the user disconnects. Without this, React 18
  // StrictMode's dev double-invoke (and any other unrelated effect re-run)
  // would inject a SECOND welcome message, re-key the list, and restart
  // the typewriter mid-animation.
  const hasInjectedRef = useRef(false);

  useEffect(() => {
    if (!isApiKeyVerified) {
      hasInjectedRef.current = false;
      return;
    }
    if (isRestoringChatState) return;
    if (hasInjectedRef.current) return;

    setMessages((prev) => {
      hasInjectedRef.current = true;
      const hasUserMessage = prev.some((message) => message.role === "user");
      if (hasUserMessage) return prev;
      return [createAssistantMessage(WELCOME_MESSAGE, { typingMs: WELCOME_TYPING_MS })];
    });
  }, [isApiKeyVerified, isRestoringChatState, setMessages]);
}
