"use client";

import { useEffect, useRef, useState } from "react";

import { ChatPanel } from "@/components/chat/chat-panel";
import { ConnectionStatusCard } from "@/components/chat/connection-status-card";
import { LockedKeyCard } from "@/components/chat/locked-key-card";
import { CrowdSilhouette } from "@/components/decoration/crowd-silhouette";
import { useLockState } from "@/components/layout/layout-root";
import { Card } from "@/components/ui/card";
import { MovingBorder } from "@/components/ui/moving-border";
import { completeAssistantAnimation } from "@/lib/chat-state";
import { useAmbientConfetti } from "@/lib/hooks/use-ambient-confetti";
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
    // Layer the crowd-booing reaction over the running ambience on
    // credential rejection. Fire-and-forget — UI state transitions
    // continue in parallel so the audio lands with the pulse-error.
    onInvalidKey: () => {
      void sound.playBoo();
    },
  });

  const isChatLocked = !key.isApiKeyVerified;

  // Propagate lock-state into <LayoutRoot> so its className updates
  // declaratively. `setIsChatLocked` from React's useState is referen-
  // tially stable, so this effect only re-runs when the lock state
  // actually changes (verify / disconnect transitions).
  const { setIsChatLocked } = useLockState();
  useEffect(() => {
    setIsChatLocked(isChatLocked);
  }, [isChatLocked, setIsChatLocked]);

  // Entry-animation gate. `panel-enter` should fire ONLY when a panel
  // mounts as the result of a locked ↔ verified TRANSITION, never on
  // the very first render (refresh / cold load). The prior `hasMounted`
  // approach failed because flipping a state flag from false→true via
  // useEffect adds the class AFTER mount → CSS sees a class addition →
  // animation fires post-mount → visible flash.
  //
  // The fix: detect the flip DURING render and call setEnteringPanel
  // unconditionally on transition only. React discards the in-progress
  // render and re-renders with the new state, so the newly-mounted
  // panel carries `panel-enter` from frame 0 — no post-mount class
  // addition, no animation flash. A 260ms timer clears the flag after
  // the keyframe (220ms) completes so subsequent re-renders of the same
  // panel instance don't keep the class indefinitely.
  const previousLockStateRef = useRef(isChatLocked);
  const [enteringPanel, setEnteringPanel] = useState<"locked" | "unlocked" | null>(null);
  if (previousLockStateRef.current !== isChatLocked) {
    previousLockStateRef.current = isChatLocked;
    setEnteringPanel(isChatLocked ? "locked" : "unlocked");
  }
  useEffect(() => {
    if (enteringPanel === null) return;
    const PANEL_ENTER_BUFFER_MS = 260;
    const timer = window.setTimeout(() => setEnteringPanel(null), PANEL_ENTER_BUFFER_MS);
    return () => window.clearTimeout(timer);
  }, [enteringPanel]);

  // Ambient confetti — fireworks + side cannons cycle while the chat is
  // unlocked. Paused while locked, hidden tab, or `prefers-reduced-motion`.
  useAmbientConfetti({ enabled: !isChatLocked });

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

  // Music auto-start for the REFRESH-OF-VERIFIED-STATE path. The
  // original music trigger lives in MessageList's `onAnimationDone`
  // callback below — it fires when the welcome typewriter completes
  // (2.2s after fresh verify). On refresh the welcome restores STATIC
  // (animate: false, no typewriter, no `onAnimationDone`), so that
  // path never fires → music never starts → user hears only crowd.
  // This effect handles the refresh case: once verified + persistence
  // restored + the first user gesture has advanced `sound.phase` away
  // from "idle" (which is how the crowd gets unlocked), if no message
  // is still typewriter-animating, start music. The latch
  // `musicStartedRef` keeps it idempotent with the typewriter path —
  // whichever fires first wins, the other no-ops.
  const { phase: soundPhase, startMusic: soundStartMusic } = sound;
  useEffect(() => {
    if (!key.isApiKeyVerified) return;
    if (persistence.isRestoringChatState) return;
    if (musicStartedRef.current) return;
    if (persistence.messages.length === 0) return;
    if (soundPhase === "idle") return;
    const hasAnimatingAssistantMessage = persistence.messages.some(
      (message) => message.role === "assistant" && message.animate === true
    );
    if (hasAnimatingAssistantMessage) return;
    musicStartedRef.current = true;
    void soundStartMusic();
  }, [
    key.isApiKeyVerified,
    persistence.isRestoringChatState,
    persistence.messages,
    soundPhase,
    soundStartMusic,
  ]);

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
    <>
      <CrowdSilhouette isVisible={key.isApiKeyVerified} />
      <section
        className={cn(
          "relative flex min-h-0 w-full justify-center",
          // Grow into the remaining LayoutRoot space ONLY when unlocked.
          // Locked stays auto-height so LayoutRoot's `justify-center` drives
          // the compact-card vertical centering. Same UX at every breakpoint.
          !isChatLocked && "min-h-0 flex-1"
        )}
      >
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
                "gap-3 p-3 sm:gap-4 sm:p-4 md:p-6"
                // No min-h: Card adapts to frame's flex-allocated height at
                // every breakpoint. Composer is always pinned to Card bottom;
                // MessageList scrolls internally via its own flex-1 min-h-0.
              )}
            >
              <ConnectionStatusCard
                statusText={statusText}
                hasError={
                  Boolean(streaming.errorMessage) ||
                  (!key.isApiKeyVerified && key.keyFeedback !== null)
                }
                isLocked={isChatLocked}
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
                    // the form's submit handler. unlockAudioContextSync runs
                    // FIRST on the synchronous call stack of the gesture so
                    // Chrome accepts the AudioContext construction as
                    // gesture-driven (suppresses the autoplay-policy
                    // informational log). The async startCrowd then handles
                    // buffer-load + playback.
                    onBeforeSubmit={() => {
                      sound.unlockAudioContextSync();
                      void sound.startCrowd();
                    }}
                    isVerifyingKey={key.isVerifyingKey}
                    isApiKeyVerified={key.isApiKeyVerified}
                    keyFeedback={key.keyFeedback}
                    keyFeedbackTone={key.keyFeedbackTone}
                    isSwappingPanel={key.isSwappingPanel}
                    isEntering={enteringPanel === "locked"}
                  />
                </div>
              ) : (
                <ChatPanel
                  messages={persistence.messages}
                  isLoading={streaming.isLoading}
                  isChatLocked={isChatLocked}
                  isRestoringChatState={persistence.isRestoringChatState}
                  isSwappingPanel={key.isSwappingPanel}
                  isEntering={enteringPanel === "unlocked"}
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
    </>
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
