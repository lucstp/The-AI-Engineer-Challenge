// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ModelSelector } from "@/components/chat/model-selector";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DEFAULT_MODEL, MODELS } from "@/lib/constants";

/**
 * ModelSelector trigger contract.
 *
 * Tests target the rendered trigger surface (label, accessibility,
 * disabled propagation). Opening the Radix Select dropdown in jsdom is
 * notoriously unreliable (portal + Floating UI), so dropdown-item
 * selection is covered by Playwright e2e instead; the route-handler
 * tests in `chat-route.test.ts` cover the validated `(message, model)`
 * payload that the trigger ultimately produces.
 */

function renderSelector(props: {
  selectedModel?: string;
  disabled?: boolean;
  onModelChange?: () => void;
}) {
  const onModelChange = props.onModelChange ?? vi.fn();
  return {
    ...render(
      <TooltipProvider>
        <ModelSelector
          selectedModel={
            // biome-ignore lint/suspicious/noExplicitAny: ModelId is a strict union; testing default fallback path requires casting
            (props.selectedModel ?? DEFAULT_MODEL) as any
          }
          onModelChange={onModelChange}
          disabled={props.disabled}
        />
      </TooltipProvider>
    ),
    onModelChange,
  };
}

describe("<ModelSelector />", () => {
  it("renders the trigger with the current model's name (Fast for the default model)", () => {
    renderSelector({ selectedModel: DEFAULT_MODEL });
    // Trigger shows ItemText (the SelectValue), which for gpt-5-mini is "Fast".
    const trigger = screen.getByRole("combobox", { name: /choose model/i });
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveTextContent("Fast");
  });

  it("renders the Balanced label when selectedModel is gpt-5", () => {
    renderSelector({ selectedModel: "gpt-5" });
    const trigger = screen.getByRole("combobox", { name: /choose model/i });
    expect(trigger).toHaveTextContent("Balanced");
  });

  it("renders the Advanced label when selectedModel is gpt-5.5", () => {
    renderSelector({ selectedModel: "gpt-5.5" });
    const trigger = screen.getByRole("combobox", { name: /choose model/i });
    expect(trigger).toHaveTextContent("Advanced");
  });

  it("propagates the disabled prop to the trigger (aria-disabled or disabled attr)", () => {
    renderSelector({ disabled: true });
    const trigger = screen.getByRole("combobox", { name: /choose model/i });
    // Radix Select sets `data-disabled` AND HTMLAttributes.disabled when disabled.
    expect(trigger).toBeDisabled();
  });

  it("does not propagate disabled when disabled is false / undefined", () => {
    renderSelector({});
    const trigger = screen.getByRole("combobox", { name: /choose model/i });
    expect(trigger).not.toBeDisabled();
  });

  it("renders an aria-label for screen readers", () => {
    renderSelector({});
    expect(screen.getByRole("combobox", { name: /choose model/i })).toHaveAttribute(
      "aria-label",
      "Choose model"
    );
  });

  it("exposes all MODELS entries as the source of truth (smoke check on constants integration)", () => {
    // The constants must match the documented three tiers — if a future
    // model is added or removed, this test fails loudly so the README +
    // route-handler allowlist can be reviewed in lockstep.
    expect(MODELS.map((m) => m.name)).toEqual(["Fast", "Balanced", "Advanced"]);
    expect(MODELS.map((m) => m.id)).toEqual(["gpt-5-mini", "gpt-5", "gpt-5.5"]);
  });
});
