// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { LockedKeyCard } from "@/components/chat/locked-key-card";
import { TooltipProvider } from "@/components/ui/tooltip";

/**
 * LockedKeyCard contract (LOCKED chat state — pre-validation).
 *
 * - Form submit fires `onSubmit` AND `onBeforeSubmit` (the synchronous
 *   audio-unlock kick-off must land inside the gesture frame)
 * - `pointerdown` ANYWHERE on the locked section ALSO fires
 *   `onBeforeSubmit` — covers the iOS WebKit case where `<input
 *   type=password>` focus preempts window-level pointerdown listeners
 * - Verify Key button is disabled while `isVerifyingKey` (shows
 *   "Verifying...") OR when the input is empty/whitespace
 * - Feedback tone color mapping: success → emerald, error → red+pulse,
 *   info → slate
 * - Default feedback line ("Server-side validation. Never stored in
 *   browser.") renders when no `keyFeedback` is provided
 */

interface RenderOpts {
  apiKeyInput?: string;
  isVerifyingKey?: boolean;
  isApiKeyVerified?: boolean;
  keyFeedback?: string | null;
  keyFeedbackTone?: "success" | "error" | "info" | null;
  isSwappingPanel?: boolean;
  isEntering?: boolean;
  onApiKeyInputChange?: (v: string) => void;
  onSubmit?: (event: React.FormEvent<HTMLFormElement>) => void;
  onBeforeSubmit?: () => void;
}

function renderCard(opts: RenderOpts = {}) {
  const onApiKeyInputChange = opts.onApiKeyInputChange ?? vi.fn();
  const onSubmit =
    opts.onSubmit ?? vi.fn((e: React.FormEvent<HTMLFormElement>) => e.preventDefault());
  const onBeforeSubmit = opts.onBeforeSubmit ?? vi.fn();
  return {
    ...render(
      <TooltipProvider>
        <LockedKeyCard
          apiKeyInput={opts.apiKeyInput ?? ""}
          onApiKeyInputChange={onApiKeyInputChange}
          onSubmit={onSubmit}
          onBeforeSubmit={onBeforeSubmit}
          isVerifyingKey={opts.isVerifyingKey ?? false}
          isApiKeyVerified={opts.isApiKeyVerified ?? false}
          keyFeedback={opts.keyFeedback ?? null}
          keyFeedbackTone={opts.keyFeedbackTone ?? null}
          isSwappingPanel={opts.isSwappingPanel ?? false}
          isEntering={opts.isEntering ?? false}
        />
      </TooltipProvider>
    ),
    onApiKeyInputChange,
    onSubmit,
    onBeforeSubmit,
  };
}

describe("<LockedKeyCard />", () => {
  it("renders the section landmark + headline + sk- input + Verify Key button + speaker pill", () => {
    renderCard();
    expect(screen.getByRole("region", { name: /openai key verification/i })).toBeInTheDocument();
    expect(screen.getByText(/unlock your coldplay companion/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/openai api key/i)).toHaveAttribute("type", "password");
    expect(screen.getByRole("button", { name: /verify key/i })).toBeInTheDocument();
    expect(screen.getByText(/turn on sound for the full experience/i)).toBeInTheDocument();
  });

  it("disables Verify Key when the input is empty", () => {
    renderCard({ apiKeyInput: "" });
    expect(screen.getByRole("button", { name: /verify key/i })).toBeDisabled();
  });

  it("disables Verify Key + shows 'Verifying...' while isVerifyingKey is true", () => {
    renderCard({ apiKeyInput: "sk-test-1234567890123456789", isVerifyingKey: true });
    // The button's accessible name swaps from "Verify key" → "Verifying..."
    // when isVerifyingKey is true, so the regex needs to match either label.
    const button = screen.getByRole("button", { name: /verify(ing)?/i });
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent("Verifying...");
  });

  it("fires onSubmit + onBeforeSubmit (in that order, gesture-time) on form submit", () => {
    const callOrder: string[] = [];
    const onBeforeSubmit = vi.fn(() => callOrder.push("before"));
    const onSubmit = vi.fn((e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      callOrder.push("submit");
    });

    renderCard({
      apiKeyInput: "sk-test-1234567890123456789",
      onBeforeSubmit,
      onSubmit,
    });

    const form = screen.getByRole("button", { name: /verify key/i }).closest("form");
    if (form === null) throw new Error("Verify Key button must be inside a <form>");
    fireEvent.submit(form);

    expect(onBeforeSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    // onBeforeSubmit MUST run synchronously BEFORE onSubmit (the audio
    // context unlock must land in the gesture frame).
    expect(callOrder).toEqual(["before", "submit"]);
  });

  it("fires onBeforeSubmit on pointerdown ANYWHERE inside the section (iOS WebKit unlock-on-any-tap)", () => {
    const onBeforeSubmit = vi.fn();
    renderCard({ onBeforeSubmit });

    fireEvent.pointerDown(screen.getByRole("region", { name: /openai key verification/i }));

    expect(onBeforeSubmit).toHaveBeenCalledTimes(1);
  });

  it("renders default microcopy when no keyFeedback is provided", () => {
    renderCard();
    expect(screen.getByText(/server-side validation/i)).toBeInTheDocument();
  });

  it("renders success-tone feedback (status role, emerald class) when keyFeedbackTone='success'", () => {
    renderCard({
      isApiKeyVerified: true,
      keyFeedback: "Key verified.",
      keyFeedbackTone: "success",
    });
    const feedback = screen.getByRole("status");
    expect(feedback).toHaveTextContent("Key verified.");
    expect(feedback.className).toContain("text-emerald-200");
  });

  it("renders error-tone feedback (alert role, red-300 + pulse class) when keyFeedbackTone='error'", () => {
    renderCard({
      keyFeedback: "Invalid key.",
      keyFeedbackTone: "error",
    });
    const feedback = screen.getByRole("alert");
    expect(feedback).toHaveTextContent("Invalid key.");
    expect(feedback.className).toContain("text-red-300");
    expect(feedback.className).toContain("animate-pulse");
  });

  it("renders info-tone feedback (status role, slate class) when keyFeedbackTone='info'", () => {
    renderCard({
      isApiKeyVerified: true,
      keyFeedback: "Session cleared — verify a new key to continue.",
      keyFeedbackTone: "info",
    });
    const feedback = screen.getByRole("status");
    expect(feedback).toHaveTextContent("Session cleared");
    expect(feedback.className).toContain("text-slate-100");
  });

  it("emits onApiKeyInputChange when the user types into the password field", () => {
    const { onApiKeyInputChange } = renderCard();
    fireEvent.change(screen.getByLabelText(/openai api key/i), {
      target: { value: "sk-typed-input" },
    });
    expect(onApiKeyInputChange).toHaveBeenCalledWith("sk-typed-input");
  });
});
