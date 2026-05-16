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
 * Injects an animated welcome message on FIRST validation of an EMPTY
 * chat. If sessionStorage already restored ANY messages — a prior
 * welcome (animate: false), a full conversation, anything — they are
 * respected as-is, so a hard refresh of a verified session does NOT
 * replay the typewriter.
 *
 * The prior "always re-inject if no user turn yet" rule caused a
 * cascading flicker on refresh: restored welcome → replaced by fresh
 * animating welcome → typewriter resets to "" → welcome height
 * collapses → prompts + any other messages reflow up → typewriter
 * fills back in → reflow back down. ~30ms visible flash on every
 * descendant of MessageList. Respecting the restored array eliminates
 * the cascade at its source. Forcing a fresh welcome after a content
 * change is the storage-key version bump's job
 * (`CHAT_UI_STATE_STORAGE_KEY` in `use-chat-persistence.ts`).
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

    // Critical: set the latch SYNCHRONOUSLY here, BEFORE setMessages.
    // setMessages's updater is queued, not synchronous — if we set the
    // ref inside the updater, React 18 StrictMode's second effect run
    // still sees hasInjectedRef.current === false and queues a SECOND
    // updater, double-injecting the welcome.
    hasInjectedRef.current = true;

    // Critical: construct the welcome message OUTSIDE the updater. Updaters
    // must be pure — StrictMode invokes them twice for purity checks, and
    // createAssistantMessage() generates a fresh UUID per call. Hoisting
    // the construction guarantees the same object reference (same id)
    // across both invocations, so the message list doesn't re-key and
    // remount the typewriter.
    const welcomeMessage = createAssistantMessage(WELCOME_MESSAGE, {
      typingMs: WELCOME_TYPING_MS,
    });

    setMessages((prev) => {
      // Respect anything already in the list — restored welcome (static),
      // restored conversation, or both. Only inject when the chat is
      // genuinely empty (first verify of a fresh session).
      if (prev.length > 0) return prev;
      return [welcomeMessage];
    });
  }, [isApiKeyVerified, isRestoringChatState, setMessages]);
}
