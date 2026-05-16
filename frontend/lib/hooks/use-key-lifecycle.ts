import { type FormEvent, useCallback, useState, useTransition } from "react";

import { clearVerifiedKeyAction } from "@/app/actions";
import type { ChatMessage } from "@/lib/chat-types";
import type { VerifyKeyResult } from "@/lib/data/auth";

export type KeyFeedbackTone = "success" | "error" | "info";

const PANEL_FADE_MS = 200;

export interface KeyLifecycle {
  apiKeyInput: string;
  isApiKeyVerified: boolean;
  isSwappingPanel: boolean;
  keyFeedback: string | null;
  keyFeedbackTone: KeyFeedbackTone | null;
  isVerifyingKey: boolean;
  isDisconnecting: boolean;
  handleApiKeyInputChange: (value: string) => void;
  verifyApiKey: (event: FormEvent<HTMLFormElement>) => void;
  disconnectVerifiedKey: () => void;
}

interface UseKeyLifecycleArgs {
  initialIsApiKeyVerified: boolean;
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  setInputValue: React.Dispatch<React.SetStateAction<string>>;
  clearPersistedState: () => void;
  /**
   * Aborts the active streaming request and resets streaming flags.
   * Stored as a ref so chat-shell.tsx can wire it AFTER both hooks
   * are constructed (resolves the cyclic dep between key + streaming).
   */
  disconnectCleanupRef: React.RefObject<(() => void) | null>;
}

/**
 * Owns key-verification + disconnect lifecycle. Drives the two-phase
 * panel-swap animation: phase 1 fades out the current panel (200ms),
 * phase 2 flips state which mounts the opposite panel + triggers the
 * shell height transition + glow burst.
 */
export function useKeyLifecycle({
  initialIsApiKeyVerified,
  setMessages,
  setInputValue,
  clearPersistedState,
  disconnectCleanupRef,
}: UseKeyLifecycleArgs): KeyLifecycle {
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [isApiKeyVerified, setIsApiKeyVerified] = useState(initialIsApiKeyVerified);
  const [isSwappingPanel, setIsSwappingPanel] = useState(false);
  const [keyFeedback, setKeyFeedback] = useState<string | null>(null);
  const [keyFeedbackTone, setKeyFeedbackTone] = useState<KeyFeedbackTone | null>(null);
  const [isVerifyingKey, startKeyVerification] = useTransition();
  const [isDisconnecting, startDisconnect] = useTransition();

  const handleApiKeyInputChange = useCallback((value: string) => {
    setApiKeyInput(value);
    setKeyFeedback((current) => {
      if (current !== null) {
        setKeyFeedbackTone(null);
      }
      return null;
    });
    setIsApiKeyVerified((current) => (current ? false : current));
  }, []);

  const verifyApiKey = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (isVerifyingKey) {
        return;
      }
      setKeyFeedback(null);
      setKeyFeedbackTone(null);
      startKeyVerification(async () => {
        // POST /api/verify-key (route handler, not Server Action). Route
        // handlers don't log request bodies, so the raw sk-... key stays
        // out of dev-mode stdout. Server-action arg-logging was the leak
        // this migration closes.
        let result: VerifyKeyResult;
        try {
          const response = await fetch("/api/verify-key", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ key: apiKeyInput }),
          });
          result = (await response.json()) as VerifyKeyResult;
        } catch {
          result = {
            ok: false,
            message: "Network unreachable. Check your connection and try again.",
          };
        }
        setKeyFeedback(result.message);
        setKeyFeedbackTone(result.ok ? "success" : "error");
        if (result.ok) {
          setApiKeyInput("");
          // Phase 1: panel-exit fade on locked card.
          setIsSwappingPanel(true);
          // Phase 2: after fade, flip → mounts chat content + shell expand + burst.
          await new Promise((resolve) => window.setTimeout(resolve, PANEL_FADE_MS));
          setIsApiKeyVerified(true);
          setIsSwappingPanel(false);
        } else {
          setIsSwappingPanel(false);
        }
      });
    },
    [apiKeyInput, isVerifyingKey, startKeyVerification]
  );

  const disconnectVerifiedKey = useCallback(() => {
    if (isDisconnecting) {
      return;
    }
    startDisconnect(async () => {
      try {
        // Phase 1: panel-exit on chat panel + reset streaming.
        setIsSwappingPanel(true);
        disconnectCleanupRef.current?.();

        // Phase 2: wait for fade, then clear all state.
        await new Promise((resolve) => window.setTimeout(resolve, PANEL_FADE_MS));

        await clearVerifiedKeyAction();
        setMessages([]);
        setInputValue("");
        setApiKeyInput("");
        setIsApiKeyVerified(false);
        setKeyFeedback("Secure key session cleared. Please verify a key to continue.");
        setKeyFeedbackTone("info");
        clearPersistedState();
        setIsSwappingPanel(false);
      } catch {
        setIsSwappingPanel(false);
      }
    });
  }, [
    clearPersistedState,
    disconnectCleanupRef,
    isDisconnecting,
    setInputValue,
    setMessages,
    startDisconnect,
  ]);

  return {
    apiKeyInput,
    isApiKeyVerified,
    isSwappingPanel,
    keyFeedback,
    keyFeedbackTone,
    isVerifyingKey,
    isDisconnecting,
    handleApiKeyInputChange,
    verifyApiKey,
    disconnectVerifiedKey,
  };
}
