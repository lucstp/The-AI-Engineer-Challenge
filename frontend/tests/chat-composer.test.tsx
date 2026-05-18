// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * ChatComposer surface contract (UNLOCKED chat state).
 *
 * - Enter key submits; Shift+Enter does not
 * - Submit / Send button is disabled when isDisabled or value is empty
 * - Stop button replaces Send while isLoading
 * - ModelSelector is rendered + receives the current model
 * - Sparkles button inserts a random prompt via onChange
 * - All three action buttons are wrapped in tooltips (Tooltip primitives
 *   require a TooltipProvider ancestor)
 *
 * `fireOnUserAction` (canvas-confetti) is mocked because canvas isn't
 * available in jsdom and the confetti side effect is irrelevant to the
 * composer's behavioral contract.
 */

vi.mock("@/lib/confetti", () => ({
  fireOnUserAction: vi.fn(),
}));

import { ChatComposer } from "@/components/chat/chat-composer";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DEFAULT_MODEL } from "@/lib/constants";

interface RenderOpts {
  value?: string;
  isLoading?: boolean;
  isDisabled?: boolean;
  selectedModel?: string;
  onChange?: (v: string) => void;
  onSubmit?: () => void;
  onStop?: () => void;
  onModelChange?: () => void;
}

function renderComposer(opts: RenderOpts = {}) {
  const onChange = opts.onChange ?? vi.fn();
  const onSubmit = opts.onSubmit ?? vi.fn();
  const onStop = opts.onStop ?? vi.fn();
  const onModelChange = opts.onModelChange ?? vi.fn();
  return {
    ...render(
      <TooltipProvider>
        <ChatComposer
          value={opts.value ?? ""}
          isLoading={opts.isLoading ?? false}
          isDisabled={opts.isDisabled ?? false}
          // biome-ignore lint/suspicious/noExplicitAny: ModelId is a strict union; cast for test ergonomics
          selectedModel={(opts.selectedModel ?? DEFAULT_MODEL) as any}
          onChange={onChange}
          onSubmit={onSubmit}
          onStop={onStop}
          onModelChange={onModelChange}
        />
      </TooltipProvider>
    ),
    onChange,
    onSubmit,
    onStop,
    onModelChange,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("<ChatComposer />", () => {
  it("renders the model selector trigger, send button, and Sparkles randomizer when not loading", () => {
    renderComposer({ value: "test" });
    expect(screen.getByRole("combobox", { name: /choose model/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /send message/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /generate random coldplay prompt/i })
    ).toBeInTheDocument();
  });

  it("calls onSubmit when Enter is pressed without Shift", () => {
    const { onSubmit } = renderComposer({ value: "hello" });
    const textarea = screen.getByRole("textbox", { name: /type your message/i });
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: false });
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("does NOT call onSubmit when Shift+Enter is pressed", () => {
    const { onSubmit } = renderComposer({ value: "hello" });
    const textarea = screen.getByRole("textbox", { name: /type your message/i });
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: true });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("disables Send when value is empty", () => {
    renderComposer({ value: "" });
    expect(screen.getByRole("button", { name: /send message/i })).toBeDisabled();
  });

  it("disables Send when isDisabled is true (locked chat)", () => {
    renderComposer({ value: "some text", isDisabled: true });
    expect(screen.getByRole("button", { name: /send message/i })).toBeDisabled();
  });

  it("renders the Stop button + hides Sparkles + Send when isLoading is true", () => {
    renderComposer({ value: "anything", isLoading: true });
    expect(
      screen.getByRole("button", { name: /stop current assistant response/i })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /generate random coldplay prompt/i })
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /send message/i })).not.toBeInTheDocument();
  });

  it("fires onStop when the Stop button is clicked", () => {
    const { onStop } = renderComposer({ value: "anything", isLoading: true });
    fireEvent.click(screen.getByRole("button", { name: /stop current assistant response/i }));
    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it("fires onChange with one of the QUICK_COLDPLAY_PROMPTS when Sparkles is clicked", () => {
    const { onChange } = renderComposer({ value: "" });
    fireEvent.click(screen.getByRole("button", { name: /generate random coldplay prompt/i }));
    expect(onChange).toHaveBeenCalledTimes(1);
    // The exact prompt is random; assert it's a non-trivial Coldplay
    // prompt string (the canonical set is 10+ chars and Coldplay-themed).
    expect(onChange).toHaveBeenCalledWith(expect.stringMatching(/.{11,}/));
  });

  it("emits onChange on textarea input (controlled-component contract)", () => {
    const { onChange } = renderComposer({ value: "" });
    const textarea = screen.getByRole("textbox", { name: /type your message/i });
    fireEvent.change(textarea, { target: { value: "draft message" } });
    expect(onChange).toHaveBeenCalledWith("draft message");
  });
});
