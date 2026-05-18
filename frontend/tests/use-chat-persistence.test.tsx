// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { ChatMessage } from "@/lib/chat-types";
import { useChatPersistence } from "@/lib/hooks/use-chat-persistence";

/**
 * Chat-persistence hook contract.
 *
 * - sessionStorage (NOT localStorage) — conversation data is wiped on Disconnect
 * - zod-validated hydrate via `persistedChatUiStateSchema`
 * - Corrupt JSON / failing schema → empty state, never a throw
 * - Persists messages + inputValue on every change AFTER restore
 * - `clearPersistedState` wipes BOTH state + scroll-top storage keys
 */

const STATE_KEY = "coldplay_chat_ui_state_v1";
const SCROLL_TOP_KEY = "coldplay_chat_scroll_top_v1";

function makeMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: "test-id",
    role: "user",
    content: "hello",
    createdAt: Date.now(),
    ...overrides,
  };
}

beforeEach(() => {
  window.sessionStorage.clear();
});

afterEach(() => {
  window.sessionStorage.clear();
});

describe("useChatPersistence", () => {
  it("initialises with empty state + finishes restoring", async () => {
    const { result } = renderHook(() => useChatPersistence());
    await waitFor(() => expect(result.current.isRestoringChatState).toBe(false));

    expect(result.current.messages).toEqual([]);
    expect(result.current.inputValue).toBe("");
  });

  it("hydrates a valid serialised state from sessionStorage", async () => {
    const stored = {
      messages: [makeMessage({ content: "restored message" })],
      inputValue: "draft text",
    };
    window.sessionStorage.setItem(STATE_KEY, JSON.stringify(stored));

    const { result } = renderHook(() => useChatPersistence());
    await waitFor(() => expect(result.current.isRestoringChatState).toBe(false));

    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0]?.content).toBe("restored message");
    expect(result.current.inputValue).toBe("draft text");
  });

  it("falls back to empty state when sessionStorage has unparseable JSON", async () => {
    window.sessionStorage.setItem(STATE_KEY, "not-valid-json[[[");

    const { result } = renderHook(() => useChatPersistence());
    await waitFor(() => expect(result.current.isRestoringChatState).toBe(false));

    expect(result.current.messages).toEqual([]);
    expect(result.current.inputValue).toBe("");
  });

  it("falls back to empty state when the stored shape fails zod validation", async () => {
    window.sessionStorage.setItem(
      STATE_KEY,
      JSON.stringify({ messages: "not-an-array", inputValue: 42 })
    );

    const { result } = renderHook(() => useChatPersistence());
    await waitFor(() => expect(result.current.isRestoringChatState).toBe(false));

    expect(result.current.messages).toEqual([]);
    expect(result.current.inputValue).toBe("");
  });

  it("persists messages + inputValue back to sessionStorage on every change", async () => {
    const { result } = renderHook(() => useChatPersistence());
    await waitFor(() => expect(result.current.isRestoringChatState).toBe(false));

    act(() => {
      result.current.setMessages([makeMessage({ content: "first turn" })]);
      result.current.setInputValue("composing");
    });

    const raw = window.sessionStorage.getItem(STATE_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw as string) as {
      messages: Array<{ content: string }>;
      inputValue: string;
    };
    expect(parsed.messages).toHaveLength(1);
    expect(parsed.messages[0]?.content).toBe("first turn");
    expect(parsed.inputValue).toBe("composing");
  });

  it("clearPersistedState removes BOTH the state and scroll-top storage keys", async () => {
    window.sessionStorage.setItem(
      STATE_KEY,
      JSON.stringify({ messages: [makeMessage()], inputValue: "x" })
    );
    window.sessionStorage.setItem(SCROLL_TOP_KEY, "240");

    const { result } = renderHook(() => useChatPersistence());
    await waitFor(() => expect(result.current.isRestoringChatState).toBe(false));

    act(() => {
      result.current.clearPersistedState();
    });

    expect(window.sessionStorage.getItem(STATE_KEY)).toBeNull();
    expect(window.sessionStorage.getItem(SCROLL_TOP_KEY)).toBeNull();
  });
});
