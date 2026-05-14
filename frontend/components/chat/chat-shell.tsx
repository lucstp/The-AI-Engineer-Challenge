"use client";

import { useRef } from "react";

import { ChatPanel } from "@/components/chat/chat-panel";
import { ConnectionStatusCard } from "@/components/chat/connection-status-card";
import { LockedKeyCard } from "@/components/chat/locked-key-card";
import { Card } from "@/components/ui/card";
import { MovingBorder } from "@/components/ui/moving-border";
import { completeAssistantAnimation } from "@/lib/chat-state";
import { useChatPersistence } from "@/lib/hooks/use-chat-persistence";
import { useChatScroll } from "@/lib/hooks/use-chat-scroll";
import { useChatStreaming } from "@/lib/hooks/use-chat-streaming";
import { useKeyLifecycle } from "@/lib/hooks/use-key-lifecycle";
import { useShellBurstFlash } from "@/lib/hooks/use-shell-burst-flash";
import { useSoundExperience } from "@/lib/hooks/use-sound-experience";
import { useWelcomeInjection } from "@/lib/hooks/use-welcome-injection";
import { cn } from "@/lib/utils";

interface ChatShellProps {
  initialIsApiKeyVerified: boolean;
}

/**
 * Top-level chat container. Pure composition — every piece of state +
 * behavior is owned by a focused hook (`@/lib/hooks/*`), and every visual
 * region by a focused sub-component (`@/components/chat/*`).
 *
 *  useChatPersistence  → messages / inputValue / restoring / scroll
 *  useChatStreaming    → submit + stop + isLoading + errorMessage
 *  useKeyLifecycle     → verify + disconnect + locked-state flags
 *  useShellBurstFlash  → 900ms glow flash on lock-state flip
 *  useWelcomeInjection → animated welcome on first validation
 *  useSoundExperience  → crowd (gesture) + music (after welcome) + toggle
 */
export function ChatShell({ initialIsApiKeyVerified }: ChatShellProps) {
  // Ref bridge so useKeyLifecycle.disconnect can call into useChatStreaming
  // without a cyclic hook dependency. Wired below after both hooks construct.
  const disconnectCleanupRef = useRef<(() => void) | null>(null);

  // Tracks whether music has been triggered for the current verified
  // session. Reset on disconnect. Prevents re-firing when the messages
  // array updates for unrelated reasons (e.g. user sends a chat message).
  const musicStartedRef = useRef(false);

  const sound = useSoundExperience();

  const persistence = useChatPersistence();

  const key = useKeyLifecycle({
    initialIsApiKeyVerified,
    setMessages: persistence.setMessages,
    setInputValue: persistence.setInputValue,
    clearPersistedState: persistence.clearPersistedState,
    disconnectCleanupRef,
  });

  const isChatLocked = !key.isApiKeyVerified;

  const streaming = useChatStreaming({
    isChatLocked,
    setMessages: persistence.setMessages,
    setInputValue: persistence.setInputValue,
  });

  // Wire the cleanup callback every render — ref stays stable, closure is fresh.
  disconnectCleanupRef.current = () => {
    streaming.activeRequestRef.current?.abort();
    streaming.activeRequestRef.current = null;
    streaming.setIsLoading(false);
    streaming.setErrorMessage(null);
    streaming.setRequestStopped(false);
    // Reset music latch so a future re-verify re-arms the music trigger.
    musicStartedRef.current = false;
    // Staggered fade-out: music first, then ~1.5s later the crowd
    // (handled internally by sound.stopAll). Fire-and-forget — disconnect
    // does not block on the audio fade.
    void sound.stopAll();
  };

  useChatScroll({
    messages: persistence.messages,
    isLoading: streaming.isLoading,
    isRestoringChatState: persistence.isRestoringChatState,
    conversationContainerRef: persistence.conversationContainerRef,
    endOfMessagesRef: persistence.endOfMessagesRef,
    pendingRestoredScrollTopRef: persistence.pendingRestoredScrollTopRef,
  });

  useWelcomeInjection({
    isApiKeyVerified: key.isApiKeyVerified,
    isRestoringChatState: persistence.isRestoringChatState,
    setMessages: persistence.setMessages,
  });

  const shellBurst = useShellBurstFlash(isChatLocked);

  const statusText = computeStatusText({
    isLoading: streaming.isLoading,
    isDisconnecting: key.isDisconnecting,
    isVerifyingKey: key.isVerifyingKey,
    isChatLocked,
    requestStopped: streaming.requestStopped,
    hasError: streaming.errorMessage !== null,
  });

  return (
    <section className="relative flex min-h-0 w-full justify-center">
      <div
        className={cn(
          "chat-shell-frame w-full",
          "max-w-[980px] lg:max-w-[940px] xl:max-w-[980px] 2xl:max-w-[1040px]",
          shellBurst && "shell-burst"
        )}
        data-state={isChatLocked ? "locked" : "unlocked"}
      >
        <MovingBorder
          borderRadius="1.5rem"
          durationMs={16000}
          borderWidthPx={2.5}
          containerClassName="h-full w-full"
        >
          <Card
            aria-label="AI chat interface"
            className={cn(
              "relative flex h-full w-full flex-col overflow-hidden text-white",
              // Backdrop frost as Tailwind v4 utilities (NOT raw `backdrop-
              // filter` in globals.css — that was conflicting with Tailwind's
              // filter architecture and silently breaking the blur). The Card
              // primitive auto-adds `chat-shell-glass` for the rest of the
              // glass styling.
              "backdrop-blur-[20px]",
              "gap-3 p-3 sm:gap-4 sm:p-4 md:p-6",
              !isChatLocked && "min-h-[520px]"
            )}
          >
            <ConnectionStatusCard
              statusText={statusText}
              hasError={
                Boolean(streaming.errorMessage) ||
                (!key.isApiKeyVerified && key.keyFeedback !== null)
              }
              onDisconnect={key.isApiKeyVerified ? key.disconnectVerifiedKey : undefined}
              isDisconnecting={key.isDisconnecting}
              isSoundEnabled={sound.isEnabled}
              onToggleSound={sound.toggleEnabled}
            />

            {isChatLocked ? (
              <div className="relative flex flex-1 flex-col justify-center">
                <LockedKeyCard
                  apiKeyInput={key.apiKeyInput}
                  onApiKeyInputChange={key.handleApiKeyInputChange}
                  onSubmit={key.verifyApiKey}
                  // User-gesture audio unlock — fires synchronously inside
                  // the form's submit handler so the browser accepts the
                  // subsequent crowd.play().
                  onBeforeSubmit={() => {
                    void sound.startCrowd();
                  }}
                  isVerifyingKey={key.isVerifyingKey}
                  isApiKeyVerified={key.isApiKeyVerified}
                  keyFeedback={key.keyFeedback}
                  keyFeedbackTone={key.keyFeedbackTone}
                  isSwappingPanel={key.isSwappingPanel}
                />
              </div>
            ) : (
              <ChatPanel
                messages={persistence.messages}
                isLoading={streaming.isLoading}
                isChatLocked={isChatLocked}
                isRestoringChatState={persistence.isRestoringChatState}
                isSwappingPanel={key.isSwappingPanel}
                errorMessage={streaming.errorMessage}
                conversationContainerRef={persistence.conversationContainerRef}
                endOfMessagesRef={persistence.endOfMessagesRef}
                onConversationScroll={persistence.handleConversationScroll}
                onAnimationDone={(messageId) => {
                  persistence.setMessages((prev) => {
                    const completed = completeAssistantAnimation(prev, messageId);
                    // First completed assistant message in the current
                    // verified session === the welcome typewriter. Kick
                    // off the music layer (idempotent on subsequent
                    // assistant turns thanks to the ref latch).
                    if (!musicStartedRef.current) {
                      const animatedMessage = prev.find((m) => m.id === messageId);
                      if (
                        animatedMessage &&
                        animatedMessage.role === "assistant" &&
                        prev.every((m) => m.role !== "user")
                      ) {
                        musicStartedRef.current = true;
                        void sound.startMusic();
                      }
                    }
                    return completed;
                  });
                }}
                onDismissError={() => streaming.setErrorMessage(null)}
                onRetryLastMessage={() => void streaming.retryLastMessage()}
                onChooseExamplePrompt={(prompt) => {
                  void streaming.submitMessage(prompt);
                }}
                inputValue={persistence.inputValue}
                onInputChange={persistence.setInputValue}
                onSubmitMessage={() => void streaming.submitMessage(persistence.inputValue)}
                onStopRequest={streaming.stopCurrentRequest}
              />
            )}
          </Card>
        </MovingBorder>
      </div>
    </section>
  );
}

function computeStatusText(input: {
  isLoading: boolean;
  isDisconnecting: boolean;
  isVerifyingKey: boolean;
  isChatLocked: boolean;
  requestStopped: boolean;
  hasError: boolean;
}): string {
  if (input.isLoading) return "Assistant is thinking...";
  if (input.isDisconnecting) return "Ending secure session...";
  if (input.isVerifyingKey) return "Validating OpenAI key...";
  if (input.isChatLocked) return "Locked";
  if (input.requestStopped) return "Response stopped";
  if (input.hasError) return "Connection issue";
  return "Connected to Coldplay knowledge space";
}
