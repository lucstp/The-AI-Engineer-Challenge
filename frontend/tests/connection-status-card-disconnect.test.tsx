// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ConnectionStatusCard } from "@/components/chat/connection-status-card";
import { TooltipProvider } from "@/components/ui/tooltip";

/**
 * ConnectionStatusCard interaction contract — complements the existing
 * `connection-status-card.test.tsx` which only covers the dot-color
 * truth table. This file exercises the Disconnect button surface:
 *
 *   - onDisconnect fires on click
 *   - Disconnect is hidden entirely when `onDisconnect` is undefined
 *     (the locked / unverified state — no session to clear)
 *   - Disconnect is disabled + shows "Disconnecting..." mid-flow
 *   - The Tooltip wrapper is present (a11y on the action consequence)
 */

interface RenderOpts {
  hasError?: boolean;
  isLocked?: boolean;
  onDisconnect?: () => void;
  isDisconnecting?: boolean;
  onToggleSound?: () => void;
}

function renderCard(opts: RenderOpts = {}) {
  const onToggleSound = opts.onToggleSound ?? vi.fn();
  return render(
    <TooltipProvider>
      <ConnectionStatusCard
        statusText="Connected to Coldplay knowledge space"
        hasError={opts.hasError ?? false}
        isLocked={opts.isLocked ?? false}
        onDisconnect={opts.onDisconnect}
        isDisconnecting={opts.isDisconnecting ?? false}
        isSoundEnabled={true}
        onToggleSound={onToggleSound}
      />
    </TooltipProvider>
  );
}

describe("<ConnectionStatusCard /> Disconnect interaction", () => {
  it("does NOT render a Disconnect button when onDisconnect is undefined (locked state)", () => {
    renderCard({ isLocked: true });
    expect(screen.queryByRole("button", { name: /disconnect/i })).not.toBeInTheDocument();
  });

  it("renders a Disconnect button when onDisconnect is provided (verified state)", () => {
    const onDisconnect = vi.fn();
    renderCard({ onDisconnect });
    expect(screen.getByRole("button", { name: /disconnect verified key/i })).toBeInTheDocument();
  });

  it("fires onDisconnect when the button is clicked", () => {
    const onDisconnect = vi.fn();
    renderCard({ onDisconnect });
    fireEvent.click(screen.getByRole("button", { name: /disconnect verified key/i }));
    expect(onDisconnect).toHaveBeenCalledTimes(1);
  });

  it("disables the button + shows 'Disconnecting...' while isDisconnecting=true", () => {
    const onDisconnect = vi.fn();
    renderCard({ onDisconnect, isDisconnecting: true });
    const button = screen.getByRole("button", { name: /disconnect verified key/i });
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent("Disconnecting...");
  });
});
