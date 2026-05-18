// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ChatMessage } from "@/lib/chat-types";
import { useWelcomeInjection } from "@/lib/hooks/use-welcome-injection";

/**
 * Welcome-injection hook contract.
 *
 * - Injects exactly once per verified session — never twice (StrictMode-
 *   double-invoke resilience via `hasInjectedRef` latch)
 * - Skips injection when the chat is locked
 * - Skips injection while sessionStorage restore is in flight (so a
 *   refresh of a verified session doesn't replay the typewriter)
 * - Respects existing restored messages — only injects into an empty list
 * - Re-arms after disconnect → re-verify (latch resets when
 *   `isApiKeyVerified` flips back to false)
 */

describe("useWelcomeInjection", () => {
  it("does not call setMessages when isApiKeyVerified is false", () => {
    const setMessages = vi.fn();
    renderHook(() =>
      useWelcomeInjection({
        isApiKeyVerified: false,
        isRestoringChatState: false,
        setMessages,
      })
    );
    expect(setMessages).not.toHaveBeenCalled();
  });

  it("does not call setMessages while isRestoringChatState is true", () => {
    const setMessages = vi.fn();
    renderHook(() =>
      useWelcomeInjection({
        isApiKeyVerified: true,
        isRestoringChatState: true,
        setMessages,
      })
    );
    expect(setMessages).not.toHaveBeenCalled();
  });

  it("injects the animated welcome when verified + not restoring + empty messages", () => {
    let resultArray: ChatMessage[] | null = null;
    const setMessages = vi.fn((updater: (prev: ChatMessage[]) => ChatMessage[]) => {
      resultArray = updater([]);
    });

    renderHook(() =>
      useWelcomeInjection({
        isApiKeyVerified: true,
        isRestoringChatState: false,
        setMessages,
      })
    );

    expect(setMessages).toHaveBeenCalledTimes(1);
    // Single shape-matching assertion sidesteps TS narrowing of
    // `resultArray?.[0]?.x` through the union with null.
    expect(resultArray).toEqual([
      expect.objectContaining({
        role: "assistant",
        animate: true,
        typingMs: expect.any(Number),
      }),
    ]);
  });

  it("preserves restored messages — updater returns prev unchanged when not empty", () => {
    const existing: ChatMessage[] = [
      { id: "1", role: "user", content: "old turn", createdAt: 1, animate: false },
    ];
    let resultArray: ChatMessage[] | null = null;
    const setMessages = vi.fn((updater: (prev: ChatMessage[]) => ChatMessage[]) => {
      resultArray = updater(existing);
    });

    renderHook(() =>
      useWelcomeInjection({
        isApiKeyVerified: true,
        isRestoringChatState: false,
        setMessages,
      })
    );

    expect(setMessages).toHaveBeenCalledTimes(1);
    // Updater returns the existing array unchanged because prev.length > 0.
    expect(resultArray).toBe(existing);
  });

  it("re-injects after disconnect → re-verify (latch resets on isApiKeyVerified flip to false)", () => {
    const setMessages = vi.fn((updater: (prev: ChatMessage[]) => ChatMessage[]) => {
      updater([]);
    });

    const { rerender } = renderHook(
      ({ isApiKeyVerified }: { isApiKeyVerified: boolean }) =>
        useWelcomeInjection({
          isApiKeyVerified,
          isRestoringChatState: false,
          setMessages,
        }),
      { initialProps: { isApiKeyVerified: true } }
    );

    expect(setMessages).toHaveBeenCalledTimes(1);

    // Disconnect: latch resets.
    rerender({ isApiKeyVerified: false });
    expect(setMessages).toHaveBeenCalledTimes(1);

    // Re-verify: latch re-armed, second injection fires.
    rerender({ isApiKeyVerified: true });
    expect(setMessages).toHaveBeenCalledTimes(2);
  });

  it("does not re-inject on stable re-renders with the same verified state (latch holds)", () => {
    const setMessages = vi.fn((updater: (prev: ChatMessage[]) => ChatMessage[]) => {
      updater([]);
    });

    const { rerender } = renderHook(() =>
      useWelcomeInjection({
        isApiKeyVerified: true,
        isRestoringChatState: false,
        setMessages,
      })
    );

    expect(setMessages).toHaveBeenCalledTimes(1);
    rerender();
    rerender();
    expect(setMessages).toHaveBeenCalledTimes(1);
  });
});
