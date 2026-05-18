// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ConnectionStatusCard } from "@/components/chat/connection-status-card";
import { TooltipProvider } from "@/components/ui/tooltip";

/**
 * Locked-state status dot color contract.
 *
 * Bug history: the original two-branch logic was `hasError ? red : green`,
 * which silently rendered green for the locked-no-error state — i.e.,
 * "Locked" with a green dot on first page load. That conflicted with the
 * UI contract that green should mean "chat is ready to use."
 *
 * Fix: introduce `isLocked` so the dot has a third semantic case. Red
 * covers both not-ready states (locked, pre-validation) AND error states
 * (invalid key, OpenAI failure). Green is reserved for verified + healthy.
 */

function renderCard(opts: { hasError: boolean; isLocked: boolean }) {
  // ConnectionStatusCard's Disconnect button is wrapped in a shadcn
  // Tooltip; Tooltip primitives require a TooltipProvider ancestor (the
  // real app provides this at the root layout). Mirror that in tests.
  return render(
    <TooltipProvider>
      <ConnectionStatusCard
        statusText="Locked"
        hasError={opts.hasError}
        isLocked={opts.isLocked}
        isSoundEnabled={true}
        onToggleSound={() => {}}
      />
    </TooltipProvider>
  );
}

function getStatusDot(container: HTMLElement): HTMLElement {
  // The status pill has role="status"; the first <span> child is the dot.
  const dot = container.querySelector('[role="status"] > span:first-child');
  if (!(dot instanceof HTMLElement)) {
    throw new Error("Status dot not found in rendered tree.");
  }
  return dot;
}

describe("<ConnectionStatusCard /> status dot color", () => {
  it("renders red dot when chat is locked and no error (pre-validation state)", () => {
    const { container } = renderCard({ hasError: false, isLocked: true });
    const dot = getStatusDot(container);
    expect(dot.className).toContain("bg-rose-400");
    expect(dot.className).not.toContain("bg-emerald-300");
  });

  it("renders red dot when an error is present (chat unlocked but failing)", () => {
    const { container } = renderCard({ hasError: true, isLocked: false });
    const dot = getStatusDot(container);
    expect(dot.className).toContain("bg-rose-400");
    expect(dot.className).not.toContain("bg-emerald-300");
  });

  it("renders red dot when both locked and erroring", () => {
    const { container } = renderCard({ hasError: true, isLocked: true });
    const dot = getStatusDot(container);
    expect(dot.className).toContain("bg-rose-400");
    expect(dot.className).not.toContain("bg-emerald-300");
  });

  it("renders green dot only when verified and healthy (the one usable state)", () => {
    const { container } = renderCard({ hasError: false, isLocked: false });
    const dot = getStatusDot(container);
    expect(dot.className).toContain("bg-emerald-300");
    expect(dot.className).toContain("status-dot-live");
    expect(dot.className).not.toContain("bg-rose-400");
  });
});
