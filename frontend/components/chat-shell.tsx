"use client";

import { FormEvent, useEffect, useRef, useState, useTransition } from "react";

import { verifyOpenAiKeyAction } from "@/app/actions";
import { BackendConnectionPanel } from "@/components/backend-connection-panel";
import { ChatComposer } from "@/components/chat-composer";
import { ConnectionStatusCard } from "@/components/connection-status-card";
import { MessageList } from "@/components/message-list";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getBackendBaseUrl, sendChatMessage } from "@/lib/chat-client";
import {
  completeAssistantAnimation,
  createAssistantMessage,
  createUserMessage
} from "@/lib/chat-state";
import { ChatMessage } from "@/lib/chat-types";
import { cn } from "@/lib/utils";

export function ChatShell() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [isApiKeyVerified, setIsApiKeyVerified] = useState(false);
  const [showBackendPanel, setShowBackendPanel] = useState(false);
  const [isSwappingPanel, setIsSwappingPanel] = useState(false);
  const [keyFeedback, setKeyFeedback] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [requestStopped, setRequestStopped] = useState(false);
  const activeRequestRef = useRef<AbortController | null>(null);
  const endOfMessagesRef = useRef<HTMLDivElement | null>(null);
  const swapTimerRef = useRef<number | null>(null);
  const [isVerifyingKey, startKeyVerification] = useTransition();
  const backendBaseUrl = getBackendBaseUrl();

  const isChatLocked = !isApiKeyVerified;
  const statusText = isLoading
    ? "Assistant is thinking..."
    : isVerifyingKey
      ? "Validating OpenAI key..."
      : isChatLocked
        ? "OpenAI key required"
        : requestStopped
          ? "Response stopped"
          : errorMessage
            ? "Connection issue"
            : "Connected to configured backend";

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages, isLoading, errorMessage]);

  useEffect(() => {
    return () => {
      if (swapTimerRef.current) {
        window.clearTimeout(swapTimerRef.current);
      }
      activeRequestRef.current?.abort();
    };
  }, []);

  async function submitMessage(messageText: string) {
    const trimmed = messageText.trim();
    if (!trimmed || isLoading || isChatLocked) {
      return;
    }

    activeRequestRef.current?.abort();
    const controller = new AbortController();
    activeRequestRef.current = controller;

    const userMessage = createUserMessage(trimmed);

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);
    setErrorMessage(null);
    setRequestStopped(false);

    try {
      const response = await sendChatMessage(createColdplayScopedPrompt(trimmed), {
        signal: controller.signal
      });
      const assistantMessage = createAssistantMessage(response.reply);
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      if (controller.signal.aborted) {
        return;
      }

      const fallback =
        "Unable to connect to the backend right now. Please make sure the FastAPI server is running on http://127.0.0.1:8000.";
      const detail = error instanceof Error ? error.message : fallback;
      setErrorMessage(detail || fallback);
    } finally {
      if (activeRequestRef.current === controller) {
        activeRequestRef.current = null;
      }
      setIsLoading(false);
    }
  }

  function submitCurrentInput() {
    void submitMessage(inputValue);
  }

  function verifyApiKey(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isVerifyingKey) {
      return;
    }

    setKeyFeedback(null);
    startKeyVerification(async () => {
      const result = await verifyOpenAiKeyAction(apiKeyInput);
      setIsApiKeyVerified(result.ok);
      setKeyFeedback(result.message);

      if (result.ok) {
        setIsSwappingPanel(true);
        swapTimerRef.current = window.setTimeout(() => {
          setShowBackendPanel(true);
          setIsSwappingPanel(false);
        }, 180);
      } else {
        setShowBackendPanel(false);
      }
    });
  }

  function stopCurrentRequest() {
    if (!activeRequestRef.current) {
      return;
    }

    activeRequestRef.current.abort();
    activeRequestRef.current = null;
    setIsLoading(false);
    setRequestStopped(true);
  }

  return (
    <main className="relative isolate flex min-h-[100svh] items-center justify-center overflow-hidden p-2 sm:p-4 lg:p-6">
      <div className="global-graphics" aria-hidden>
        <picture className="header__bg-img">
          <img
            src="https://www.coldplay.com/wp/wp-content/themes/coldplay-2024/dist/images/bg-top-left.webp"
            alt=""
            className="header__bg"
            decoding="async"
            loading="lazy"
          />
        </picture>
        <picture className="header__bg-2-img">
          <img
            src="https://www.coldplay.com/wp/wp-content/themes/coldplay-2024/dist/images/bg-right.webp"
            alt=""
            className="header__bg"
            decoding="async"
            loading="lazy"
          />
        </picture>
        <picture className="footer__bg-img">
          <img
            src="https://www.coldplay.com/wp/wp-content/themes/coldplay-2024/dist/images/bg-bottom-left.webp"
            alt=""
            className="footer__bg"
            decoding="async"
            loading="lazy"
          />
        </picture>
        <picture className="footer__bg-2-img">
          <img
            src="https://www.coldplay.com/wp/wp-content/themes/coldplay-2024/dist/images/bg-bottom-left.webp"
            alt=""
            className="footer__bg"
            decoding="async"
            loading="lazy"
          />
        </picture>
      </div>

      <div
        className={cn(
          "relative w-full",
          "max-w-[980px] xl:max-w-[1080px] 2xl:max-w-[1200px]",
          "h-[96svh] sm:h-[92svh] sm:max-h-[860px] xl:max-h-[940px] 2xl:max-h-[1020px]",
          "min-h-[520px]"
        )}
      >
        {/* Decorative offset glass panels behind the main card to suggest
            stacked depth, like the reference glassmorphism layout. Disabled
            on small viewports to keep the mobile UI calm. */}
        <div aria-hidden className="pointer-events-none absolute inset-0 hidden md:block">
          <div className="absolute inset-0 -translate-x-3 -translate-y-2 -rotate-[1.5deg] rounded-3xl border border-white/20 bg-gradient-to-br from-white/[0.10] to-white/[0.03] backdrop-blur-xl backdrop-saturate-150 shadow-[0_30px_70px_-10px_rgba(2,6,23,0.45),inset_0_1px_0_rgba(255,255,255,0.28)]" />
          <div className="absolute inset-0 translate-x-3 translate-y-2 rotate-[1.2deg] rounded-3xl border border-white/25 bg-gradient-to-br from-white/[0.12] to-white/[0.04] backdrop-blur-xl backdrop-saturate-150 shadow-[0_24px_60px_-8px_rgba(2,6,23,0.4),inset_0_1px_0_rgba(255,255,255,0.32)]" />
        </div>

        <Card
          aria-label="AI chat interface"
          className={cn(
            "relative grid h-full w-full grid-rows-[auto_auto_minmax(0,1fr)_auto] overflow-hidden",
            "gap-3 p-3 sm:gap-4 sm:p-4 md:p-6"
          )}
        >
        <ConnectionStatusCard
          statusText={statusText}
          hasError={Boolean(errorMessage) || (!isApiKeyVerified && keyFeedback !== null)}
        />

        <div className="relative">
          {showBackendPanel ? (
            <div className="panel-enter">
              <BackendConnectionPanel
                backendBaseUrl={backendBaseUrl}
                verificationMessage="Key verified. You can start chatting."
              />
            </div>
          ) : (
            <Card
              aria-label="OpenAI key verification"
              className={cn(isSwappingPanel ? "panel-exit" : "panel-enter")}
            >
              <CardHeader>
                <CardTitle>OpenAI key verification</CardTitle>
                <p className="text-sm text-slate-200/90">
                  Enter your OpenAI key to unlock chat. Validation runs server-side and key values
                  are not persisted in browser storage.
                </p>
              </CardHeader>
              <CardContent>
                <form
                  onSubmit={verifyApiKey}
                  className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_auto] md:gap-3"
                >
                  <Label htmlFor="openai-key" className="sr-only">
                    OpenAI API key
                  </Label>
                  <Input
                    id="openai-key"
                    type="password"
                    autoComplete="off"
                    value={apiKeyInput}
                    onChange={(event) => {
                      setApiKeyInput(event.target.value);
                      if (keyFeedback) {
                        setKeyFeedback(null);
                      }
                      if (isApiKeyVerified) {
                        setIsApiKeyVerified(false);
                      }
                    }}
                    placeholder="sk-..."
                    aria-describedby="key-feedback"
                  />
                  <Button
                    type="submit"
                    disabled={isVerifyingKey || apiKeyInput.trim().length === 0}
                  >
                    {isVerifyingKey ? "Verifying..." : "Verify key"}
                  </Button>
                </form>
                {keyFeedback ? (
                  <p
                    id="key-feedback"
                    role={isApiKeyVerified ? "status" : "alert"}
                    className={cn(
                      "mt-2 text-sm font-semibold",
                      isApiKeyVerified ? "text-amber-200" : "text-rose-200"
                    )}
                  >
                    {keyFeedback}
                  </p>
                ) : null}
              </CardContent>
            </Card>
          )}
        </div>

        <MessageList
          messages={messages}
          isLoading={isLoading}
          isLocked={isChatLocked}
          errorMessage={errorMessage}
          onAnimationDone={(messageId) => {
            setMessages((prev) => completeAssistantAnimation(prev, messageId));
          }}
          onDismissError={() => setErrorMessage(null)}
          onChooseExamplePrompt={(prompt) => {
            void submitMessage(prompt);
          }}
          endOfMessagesRef={endOfMessagesRef}
        />

        <ChatComposer
          value={inputValue}
          isLoading={isLoading}
          isDisabled={isChatLocked}
          onChange={setInputValue}
          onSubmit={submitCurrentInput}
          onStop={stopCurrentRequest}
        />
        </Card>
      </div>
    </main>
  );
}

function createColdplayScopedPrompt(userInput: string): string {
  return [
    "You are a Coldplay-only assistant.",
    "Answer only questions about Coldplay, including members, albums, songs, tours, timelines, and related official context.",
    "If the user asks about non-Coldplay topics, politely refuse and redirect to Coldplay-focused help.",
    `User question: ${userInput}`
  ].join("\n");
}
