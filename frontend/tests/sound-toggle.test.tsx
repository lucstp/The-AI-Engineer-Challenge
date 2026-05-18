// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SoundToggle } from "@/components/sound/sound-toggle";
import { TooltipProvider } from "@/components/ui/tooltip";

/**
 * SoundToggle is an icon-only Volume2/VolumeX button — the kind of
 * control that absolutely needs a tooltip + correct aria-pressed
 * semantics for screen readers. The Tooltip-wrapped trigger requires
 * a <TooltipProvider> ancestor in tests (mirrors the real root layout).
 */

function renderToggle(props: { isEnabled: boolean; onToggle?: () => void }) {
  const onToggle = props.onToggle ?? vi.fn();
  return {
    ...render(
      <TooltipProvider>
        <SoundToggle isEnabled={props.isEnabled} onToggle={onToggle} />
      </TooltipProvider>
    ),
    onToggle,
  };
}

describe("<SoundToggle />", () => {
  it("renders aria-pressed=true and Mute label when sound is enabled", () => {
    renderToggle({ isEnabled: true });
    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(button).toHaveAttribute("aria-label", "Mute ambient sound");
  });

  it("renders aria-pressed=false and Enable label when sound is disabled", () => {
    renderToggle({ isEnabled: false });
    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("aria-pressed", "false");
    expect(button).toHaveAttribute("aria-label", "Enable ambient sound");
  });

  it("fires onToggle when the button is clicked", () => {
    const { onToggle } = renderToggle({ isEnabled: true });
    fireEvent.click(screen.getByRole("button"));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
