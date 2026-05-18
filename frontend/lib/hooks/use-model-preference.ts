"use client";

import { useCallback, useEffect, useLayoutEffect, useState } from "react";

import { DEFAULT_MODEL, isModelId, type ModelId } from "@/lib/constants";

const MODEL_PREFERENCE_STORAGE_KEY = "coldplay_model_preference_v1";

export interface ModelPreference {
  selectedModel: ModelId;
  setSelectedModel: (model: ModelId) => void;
  isRestoring: boolean;
}

/**
 * Owns the persisted model preference. Lives in localStorage (not
 * sessionStorage) because model choice is a UI setting, not conversation
 * data — Disconnect's contract is "credentials + chat cleared", not
 * "preferences reset." Defensive on hydrate: `isModelId` type-guard so a
 * tampered localStorage value falls back to DEFAULT_MODEL rather than
 * poisoning the dropdown.
 */
export function useModelPreference(): ModelPreference {
  const [selectedModel, setSelectedModelState] = useState<ModelId>(DEFAULT_MODEL);
  const [isRestoring, setIsRestoring] = useState(true);

  useLayoutEffect(() => {
    try {
      const stored = window.localStorage.getItem(MODEL_PREFERENCE_STORAGE_KEY);
      if (stored !== null && isModelId(stored)) {
        setSelectedModelState(stored);
      }
    } catch {
      // localStorage unavailable (Safari private mode, ITP) — keep DEFAULT_MODEL.
    } finally {
      setIsRestoring(false);
    }
  }, []);

  useEffect(() => {
    if (isRestoring) return;
    try {
      window.localStorage.setItem(MODEL_PREFERENCE_STORAGE_KEY, selectedModel);
    } catch {
      // localStorage unavailable — preference is a soft UI state, fail open.
    }
  }, [selectedModel, isRestoring]);

  const setSelectedModel = useCallback((model: ModelId) => {
    setSelectedModelState(model);
  }, []);

  return { selectedModel, setSelectedModel, isRestoring };
}
