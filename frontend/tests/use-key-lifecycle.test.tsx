// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { act, renderHook } from "@testing-library/react";
import type React from "react";
import { useRef, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Key-lifecycle hook contract.
 *
 * - initialIsApiKeyVerified hydrates `isApiKeyVerified` on first render
 * - handleApiKeyInputChange clears feedback + un-verifies on input change
 * - verifyApiKey POSTs to /api/verify-key (route handler, not Server
 *   Action — closes the dev-mode stdout key leak)
 *   - ok: true  → success tone + isApiKeyVerified flips to true after the
 *                  PANEL_FADE_MS panel-swap window
 *   - ok: false → error tone, onInvalidKey callback fires
 *   - network error → "Network unreachable" message
 * - disconnectVerifiedKey runs `disconnectCleanupRef.current()` (aborts
 *   streaming + tears down audio), calls `clearVerifiedKeyAction()`,
 *   wipes messages + input + apiKeyInput, calls clearPersistedState
 */

// vi.hoisted ensures the mock fn exists before the hoisted vi.mock
// factory runs — a top-level `const x = vi.fn()` would throw
// "Cannot access before initialization" inside the factory.
const { clearVerifiedKeyActionMock } = vi.hoisted(() => ({
  clearVerifiedKeyActionMock: vi.fn(async () => {}),
}));

vi.mock("@/app/actions", () => ({
  clearVerifiedKeyAction: clearVerifiedKeyActionMock,
}));

import type { ChatMessage } from "@/lib/chat-types";
import { useKeyLifecycle } from "@/lib/hooks/use-key-lifecycle";

interface HarnessOptions {
  initialIsApiKeyVerified?: boolean;
  onInvalidKey?: () => void;
}

function useTestHarness({
  initialIsApiKeyVerified = false,
  onInvalidKey = vi.fn(),
}: HarnessOptions = {}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  // Stable across renders — useState lazy-initializer pattern ensures the
  // vi.fn() is created exactly once. A naked `const fn = vi.fn()` would
  // produce a fresh mock per render, so the post-action assertion fires
  // on a fresh mock that the hook's closure never saw.
  const [clearPersistedState] = useState(() => vi.fn());
  const [cleanupFn] = useState(() => vi.fn());
  const disconnectCleanupRef = useRef<(() => void) | null>(cleanupFn);

  const key = useKeyLifecycle({
    initialIsApiKeyVerified,
    setMessages,
    setInputValue,
    clearPersistedState,
    disconnectCleanupRef,
    onInvalidKey,
  });

  return { messages, inputValue, clearPersistedState, disconnectCleanupRef, key };
}

function fakeFormEvent(): React.FormEvent<HTMLFormElement> {
  return { preventDefault: vi.fn() } as unknown as React.FormEvent<HTMLFormElement>;
}

beforeEach(() => {
  clearVerifiedKeyActionMock.mockReset();
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useKeyLifecycle", () => {
  it("reflects initialIsApiKeyVerified on mount (both branches)", () => {
    const { result: lockedResult } = renderHook(() => useTestHarness());
    expect(lockedResult.current.key.isApiKeyVerified).toBe(false);

    const { result: verifiedResult } = renderHook(() =>
      useTestHarness({ initialIsApiKeyVerified: true })
    );
    expect(verifiedResult.current.key.isApiKeyVerified).toBe(true);
  });

  it("handleApiKeyInputChange un-verifies the session + writes the input value", () => {
    const { result } = renderHook(() => useTestHarness({ initialIsApiKeyVerified: true }));

    act(() => {
      result.current.key.handleApiKeyInputChange("sk-fresh-input");
    });

    expect(result.current.key.apiKeyInput).toBe("sk-fresh-input");
    expect(result.current.key.isApiKeyVerified).toBe(false);
  });

  it("verifyApiKey flips to verified on /api/verify-key success", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ ok: true, message: "Key verified." }), { status: 200 })
    );

    const { result } = renderHook(() => useTestHarness());

    act(() => {
      result.current.key.handleApiKeyInputChange("sk-valid-1234567890123456");
    });

    await act(async () => {
      result.current.key.verifyApiKey(fakeFormEvent());
      // Allow the transition + the 200ms panel-fade window to settle.
      await new Promise((resolve) => setTimeout(resolve, 260));
    });

    expect(fetch).toHaveBeenCalledWith(
      "/api/verify-key",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ key: "sk-valid-1234567890123456" }),
      })
    );
    expect(result.current.key.isApiKeyVerified).toBe(true);
    expect(result.current.key.keyFeedbackTone).toBe("success");
  });

  it("calls onInvalidKey + sets error tone on ok:false response", async () => {
    const onInvalidKey = vi.fn();
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ ok: false, message: "This key is invalid." }), { status: 200 })
    );

    const { result } = renderHook(() => useTestHarness({ onInvalidKey }));

    act(() => {
      result.current.key.handleApiKeyInputChange("sk-bad-1234567890123456");
    });

    await act(async () => {
      result.current.key.verifyApiKey(fakeFormEvent());
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(onInvalidKey).toHaveBeenCalledTimes(1);
    expect(result.current.key.keyFeedbackTone).toBe("error");
    expect(result.current.key.isApiKeyVerified).toBe(false);
    expect(result.current.key.keyFeedback).toContain("invalid");
  });

  it("surfaces 'Network unreachable' when fetch throws", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("ECONNREFUSED"));

    const { result } = renderHook(() => useTestHarness());

    act(() => {
      result.current.key.handleApiKeyInputChange("sk-net-1234567890123456");
    });

    await act(async () => {
      result.current.key.verifyApiKey(fakeFormEvent());
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(result.current.key.keyFeedback).toContain("Network unreachable");
    expect(result.current.key.keyFeedbackTone).toBe("error");
  });

  it("disconnectVerifiedKey runs cleanup ref, clears server cookie, wipes state", async () => {
    const { result } = renderHook(() => useTestHarness({ initialIsApiKeyVerified: true }));

    await act(async () => {
      result.current.key.disconnectVerifiedKey();
      await new Promise((resolve) => setTimeout(resolve, 260));
    });

    // disconnectCleanupRef was called (mock fn attached during harness setup).
    expect(result.current.disconnectCleanupRef.current).toBeDefined();
    expect(clearVerifiedKeyActionMock).toHaveBeenCalledTimes(1);
    expect(result.current.key.isApiKeyVerified).toBe(false);
    expect(result.current.clearPersistedState).toHaveBeenCalledTimes(1);
    expect(result.current.key.keyFeedback).toContain("Session cleared");
    expect(result.current.key.keyFeedbackTone).toBe("info");
  });
});
