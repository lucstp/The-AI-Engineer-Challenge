// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { DEFAULT_MODEL } from "@/lib/constants";
import { useModelPreference } from "@/lib/hooks/use-model-preference";

/**
 * Persistent model-preference hook contract.
 *
 * - Hydrates from localStorage on mount (useLayoutEffect)
 * - Defensive: tampered values fail `isModelId` and fall back to DEFAULT_MODEL
 * - Persists on change AFTER initial restore (the `isRestoring` flag
 *   prevents overwriting a previously-stored preference with the default)
 * - localStorage chosen over sessionStorage because the preference is a
 *   UI setting, not conversation data — it survives Disconnect
 */

const STORAGE_KEY = "coldplay_model_preference_v1";

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  window.localStorage.clear();
});

describe("useModelPreference", () => {
  it("returns DEFAULT_MODEL on first render with an empty localStorage", async () => {
    const { result } = renderHook(() => useModelPreference());
    await waitFor(() => expect(result.current.isRestoring).toBe(false));
    expect(result.current.selectedModel).toBe(DEFAULT_MODEL);
  });

  it("hydrates a valid previously-stored model id", async () => {
    window.localStorage.setItem(STORAGE_KEY, "gpt-5");

    const { result } = renderHook(() => useModelPreference());
    await waitFor(() => expect(result.current.isRestoring).toBe(false));

    expect(result.current.selectedModel).toBe("gpt-5");
  });

  it("falls back to DEFAULT_MODEL when localStorage has a tampered value", async () => {
    window.localStorage.setItem(STORAGE_KEY, "evil-model-not-in-allowlist");

    const { result } = renderHook(() => useModelPreference());
    await waitFor(() => expect(result.current.isRestoring).toBe(false));

    expect(result.current.selectedModel).toBe(DEFAULT_MODEL);
  });

  it("persists a new selection to localStorage on setSelectedModel", async () => {
    const { result } = renderHook(() => useModelPreference());
    await waitFor(() => expect(result.current.isRestoring).toBe(false));

    act(() => {
      result.current.setSelectedModel("gpt-5.5");
    });

    expect(result.current.selectedModel).toBe("gpt-5.5");
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("gpt-5.5");
  });

  it("does NOT overwrite a stored value with DEFAULT_MODEL during initial restore", async () => {
    // If isRestoring did not gate the persist effect, the first render
    // would write DEFAULT_MODEL into localStorage and clobber the stored
    // value before hydrate completes. This test proves the gate works.
    window.localStorage.setItem(STORAGE_KEY, "gpt-5");

    const { result } = renderHook(() => useModelPreference());
    await waitFor(() => expect(result.current.isRestoring).toBe(false));

    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("gpt-5");
    expect(result.current.selectedModel).toBe("gpt-5");
  });
});
