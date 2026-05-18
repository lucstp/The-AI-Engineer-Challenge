// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Sound-experience hook contract.
 *
 * - Owns the AudioOrchestrator lifecycle (construct on mount, destroy on
 *   unmount)
 * - Phase machine: idle → crowd-only → crowd-and-music
 * - Preference (`isEnabled`) hydrated from sessionStorage; persisted on
 *   change; gate audio playback ALL calls (`playBoo` / `unlockAudioContextSync`
 *   no-op when disabled)
 * - `toggleEnabled` fades audio out on mute, resumes on unmute according
 *   to current phase
 *
 * `AudioOrchestrator` is mocked because Web Audio API is not available
 * in jsdom. Mocking proves the hook's wiring without depending on a
 * real audio context.
 */

// Mocks are declared via vi.hoisted so they exist BEFORE the hoisted
// vi.mock factory runs. The mock value for AudioOrchestrator is a class
// (not an arrow function) so `new AudioOrchestrator()` inside the hook
// can use it as a constructor.
const mocks = vi.hoisted(() => ({
  startCrowd: vi.fn(async () => {}),
  startMusic: vi.fn(async () => {}),
  playBoo: vi.fn(async () => {}),
  stopAll: vi.fn(async () => {}),
  mute: vi.fn(async () => {}),
  resume: vi.fn(async () => {}),
  unlockAudioContextSync: vi.fn(() => {}),
  destroy: vi.fn(() => {}),
}));

vi.mock("@/lib/audio/audio-orchestrator", () => {
  class MockAudioOrchestrator {
    startCrowd = mocks.startCrowd;
    startMusic = mocks.startMusic;
    playBoo = mocks.playBoo;
    stopAll = mocks.stopAll;
    mute = mocks.mute;
    resume = mocks.resume;
    unlockAudioContextSync = mocks.unlockAudioContextSync;
    destroy = mocks.destroy;
  }
  return { AudioOrchestrator: MockAudioOrchestrator };
});

const SOUND_KEY = "coldplay_sound_enabled_v1";

beforeEach(() => {
  for (const mock of Object.values(mocks)) {
    mock.mockClear();
  }
  window.sessionStorage.clear();
});

afterEach(() => {
  window.sessionStorage.clear();
});

// Imported AFTER vi.mock so the hook picks up the mocked orchestrator.
import { useSoundExperience } from "@/lib/hooks/use-sound-experience";

describe("useSoundExperience", () => {
  it("starts in idle phase with sound enabled by default", async () => {
    const { result } = renderHook(() => useSoundExperience());
    await waitFor(() => expect(result.current.isEnabled).toBe(true));
    expect(result.current.phase).toBe("idle");
  });

  it("loads `isEnabled=false` from sessionStorage when previously muted", async () => {
    window.sessionStorage.setItem(SOUND_KEY, "false");
    const { result } = renderHook(() => useSoundExperience());
    await waitFor(() => expect(result.current.isEnabled).toBe(false));
  });

  it("advances to crowd-only phase on startCrowd and forwards to the orchestrator", async () => {
    const { result } = renderHook(() => useSoundExperience());
    await waitFor(() => expect(result.current.isEnabled).toBe(true));

    await act(async () => {
      await result.current.startCrowd();
    });

    expect(result.current.phase).toBe("crowd-only");
    expect(mocks.startCrowd).toHaveBeenCalled();
  });

  it("advances to crowd-and-music phase on startMusic and forwards to the orchestrator", async () => {
    const { result } = renderHook(() => useSoundExperience());
    await waitFor(() => expect(result.current.isEnabled).toBe(true));

    await act(async () => {
      await result.current.startCrowd();
      await result.current.startMusic();
    });

    expect(result.current.phase).toBe("crowd-and-music");
    expect(mocks.startMusic).toHaveBeenCalled();
  });

  it("playBoo no-ops when sound is disabled", async () => {
    window.sessionStorage.setItem(SOUND_KEY, "false");
    const { result } = renderHook(() => useSoundExperience());
    await waitFor(() => expect(result.current.isEnabled).toBe(false));

    await act(async () => {
      await result.current.playBoo();
    });

    expect(mocks.playBoo).not.toHaveBeenCalled();
  });

  it("unlockAudioContextSync no-ops when sound is disabled", async () => {
    window.sessionStorage.setItem(SOUND_KEY, "false");
    const { result } = renderHook(() => useSoundExperience());
    await waitFor(() => expect(result.current.isEnabled).toBe(false));

    act(() => {
      result.current.unlockAudioContextSync();
    });

    expect(mocks.unlockAudioContextSync).not.toHaveBeenCalled();
  });

  it("toggleEnabled persists the preference and fades audio out on mute", async () => {
    const { result } = renderHook(() => useSoundExperience());
    await waitFor(() => expect(result.current.isEnabled).toBe(true));

    act(() => {
      result.current.toggleEnabled();
    });

    expect(result.current.isEnabled).toBe(false);
    expect(window.sessionStorage.getItem(SOUND_KEY)).toBe("false");
    expect(mocks.mute).toHaveBeenCalled();
  });

  it("destroys the orchestrator on unmount", async () => {
    const { unmount, result } = renderHook(() => useSoundExperience());
    await waitFor(() => expect(result.current.isEnabled).toBe(true));
    unmount();
    expect(mocks.destroy).toHaveBeenCalled();
  });
});
