// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { act, renderHook, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Chat-streaming hook contract.
 *
 * - submitMessage adds a user message + an assistant placeholder, then
 *   pipes chunks from `streamChatMessage` into the assistant placeholder
 * - The `(message, model)` pair is captured on every submit so Retry can
 *   replay the EXACT original payload — model threading is part of the
 *   contract, not the implementation
 * - isChatLocked rejects submission silently (no fetch, no state change)
 * - stopCurrentRequest aborts the in-flight AbortController and sets
 *   `requestStopped: true`
 *
 * `streamChatMessage` from chat-client is mocked at the module boundary
 * — its real implementation hits `/api/chat`, which is exercised by the
 * route-handler tests.
 */

// vi.hoisted ensures the mock fn exists before the hoisted vi.mock
// factory runs — a top-level `const streamChatMessageMock = vi.fn()`
// would throw "Cannot access before initialization" inside the factory.
const { streamChatMessageMock } = vi.hoisted(() => ({
  streamChatMessageMock: vi.fn(),
}));

vi.mock("@/lib/chat-client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/chat-client")>("@/lib/chat-client");
  return {
    ...actual,
    streamChatMessage: streamChatMessageMock,
  };
});

import type { ChatMessage } from "@/lib/chat-types";
import { useChatStreaming } from "@/lib/hooks/use-chat-streaming";

function useTestHarness(isChatLocked = false) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const streaming = useChatStreaming({ isChatLocked, setMessages, setInputValue });
  return { messages, inputValue, ...streaming };
}

beforeEach(() => {
  streamChatMessageMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useChatStreaming", () => {
  it("initialises with isLoading=false, no error, no stopped flag", () => {
    const { result } = renderHook(() => useTestHarness());
    expect(result.current.isLoading).toBe(false);
    expect(result.current.errorMessage).toBeNull();
    expect(result.current.requestStopped).toBe(false);
  });

  it("submitMessage forwards (message, model) to streamChatMessage and appends both turns", async () => {
    streamChatMessageMock.mockImplementation(async (_msg, options) => {
      options.onChunk("Hello from the assistant.");
    });

    const { result } = renderHook(() => useTestHarness());

    await act(async () => {
      await result.current.submitMessage("test query", "gpt-5");
    });

    expect(streamChatMessageMock).toHaveBeenCalledTimes(1);
    expect(streamChatMessageMock).toHaveBeenCalledWith(
      "test query",
      expect.objectContaining({ model: "gpt-5" })
    );
    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[0]?.role).toBe("user");
    expect(result.current.messages[0]?.content).toBe("test query");
    expect(result.current.messages[1]?.role).toBe("assistant");
    expect(result.current.messages[1]?.content).toBe("Hello from the assistant.");
  });

  it("silently rejects submitMessage when the chat is locked (no fetch, no state change)", async () => {
    const { result } = renderHook(() => useTestHarness(/* isChatLocked */ true));

    await act(async () => {
      await result.current.submitMessage("test", "gpt-5-mini");
    });

    expect(streamChatMessageMock).not.toHaveBeenCalled();
    expect(result.current.messages).toEqual([]);
  });

  it("retryLastMessage replays the original (message, model) pair", async () => {
    streamChatMessageMock.mockImplementation(async (_msg, options) => {
      options.onChunk("first reply");
    });

    const { result } = renderHook(() => useTestHarness());

    await act(async () => {
      await result.current.submitMessage("original prompt", "gpt-5");
    });

    streamChatMessageMock.mockClear();

    // User changes the dropdown — but retry must replay the ORIGINAL model.
    await act(async () => {
      await result.current.retryLastMessage();
    });

    expect(streamChatMessageMock).toHaveBeenCalledTimes(1);
    expect(streamChatMessageMock).toHaveBeenCalledWith(
      "original prompt",
      expect.objectContaining({ model: "gpt-5" })
    );
  });

  it("stopCurrentRequest aborts the in-flight controller and clears isLoading", async () => {
    let capturedSignal: AbortSignal | undefined;
    streamChatMessageMock.mockImplementation(async (_msg, options) => {
      capturedSignal = options.signal;
      // Hang forever — simulates a streaming response we want to abort.
      await new Promise<void>(() => {});
    });

    const { result } = renderHook(() => useTestHarness());

    // Fire-and-forget submit inside act so React can schedule the
    // isLoading=true state flip; we then stop while it's pending.
    act(() => {
      void result.current.submitMessage("hang query", "gpt-5");
    });

    await waitFor(() => expect(result.current.isLoading).toBe(true));

    act(() => {
      result.current.stopCurrentRequest();
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.requestStopped).toBe(true);
    expect(capturedSignal?.aborted).toBe(true);
  });

  it("surfaces an error when the assistant returns an empty response", async () => {
    streamChatMessageMock.mockImplementation(async () => {
      // No onChunk call — simulates the "no content delta" edge case.
    });

    const { result } = renderHook(() => useTestHarness());

    await act(async () => {
      await result.current.submitMessage("query", "gpt-5-mini");
    });

    expect(result.current.errorMessage).toContain("empty response");
    expect(result.current.isLoading).toBe(false);
  });
});
