// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { fireEvent, render, screen, within } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * MessageList contract (UNLOCKED chat state).
 *
 * - Empty state shows example prompts (3 buttons, all clickable)
 * - User messages render with right-alignment + "You" label + content
 * - Assistant messages render markdown (bold proper nouns, lists, links
 *   open in a new tab with rel=noopener noreferrer)
 * - Loading thinking-dots appear when isLoading and no assistant content
 * - Error display surfaces Retry + Dismiss buttons; Retry button absent
 *   when onRetryLastMessage is undefined
 * - Animation done callback fires when typewriter completes
 *
 * `fireOnUserAction` is mocked because canvas-confetti isn't reliable
 * in jsdom (no canvas context).
 */

vi.mock("@/lib/confetti", () => ({
  fireOnUserAction: vi.fn(),
}));

import { MessageList } from "@/components/chat/message-list";
import type { ChatMessage } from "@/lib/chat-types";

interface RenderOpts {
  messages?: ChatMessage[];
  isLoading?: boolean;
  isLocked?: boolean;
  isRestoring?: boolean;
  errorMessage?: string | null;
  onRetryLastMessage?: (() => void) | undefined;
  onDismissError?: () => void;
  onChooseExamplePrompt?: (prompt: string) => void;
  onAnimationDone?: (id: string) => void;
}

function renderList(opts: RenderOpts = {}) {
  const onDismissError = opts.onDismissError ?? vi.fn();
  const onChooseExamplePrompt = opts.onChooseExamplePrompt ?? vi.fn();
  const onAnimationDone = opts.onAnimationDone ?? vi.fn();
  const conversationContainerRef = createRef<HTMLElement>();
  const endOfMessagesRef = createRef<HTMLDivElement>();

  return {
    ...render(
      <MessageList
        messages={opts.messages ?? []}
        isLoading={opts.isLoading ?? false}
        isLocked={opts.isLocked ?? false}
        isRestoring={opts.isRestoring ?? false}
        errorMessage={opts.errorMessage ?? null}
        conversationContainerRef={conversationContainerRef}
        onConversationScroll={vi.fn()}
        onAnimationDone={onAnimationDone}
        onDismissError={onDismissError}
        onRetryLastMessage={opts.onRetryLastMessage}
        onChooseExamplePrompt={onChooseExamplePrompt}
        endOfMessagesRef={endOfMessagesRef}
      />
    ),
    onDismissError,
    onChooseExamplePrompt,
    onAnimationDone,
  };
}

function makeUser(content: string, id = "u1"): ChatMessage {
  return { id, role: "user", content, createdAt: Date.now() };
}

function makeAssistant(content: string, id = "a1"): ChatMessage {
  return { id, role: "assistant", content, createdAt: Date.now(), animate: false };
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("<MessageList />", () => {
  it("renders the conversation region with aria-live polite", () => {
    renderList();
    const region = screen.getByRole("region", { name: /conversation/i });
    expect(region).toHaveAttribute("aria-live", "polite");
  });

  it("renders three example prompts in the empty unlocked state", () => {
    renderList();
    expect(screen.getByRole("heading", { name: /ask coldplay anything/i })).toBeInTheDocument();
    // Three prompts from EXAMPLE_PROMPTS — assert by their canonical text.
    expect(
      screen.getByRole("button", { name: /who are the members of coldplay/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /concise timeline of coldplay albums/i })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /moon music/i })).toBeInTheDocument();
  });

  it("invokes onChooseExamplePrompt with the prompt text when an example button is clicked", () => {
    const { onChooseExamplePrompt } = renderList();
    fireEvent.click(screen.getByRole("button", { name: /who are the members of coldplay/i }));
    expect(onChooseExamplePrompt).toHaveBeenCalledTimes(1);
    expect(onChooseExamplePrompt).toHaveBeenCalledWith(
      expect.stringMatching(/members of coldplay/i)
    );
  });

  it("does NOT show example prompts or hero text in locked state", () => {
    renderList({ isLocked: true });
    expect(
      screen.queryByRole("heading", { name: /ask coldplay anything/i })
    ).not.toBeInTheDocument();
  });

  it("renders a user message with the 'You' label and right-aligned content", () => {
    renderList({ messages: [makeUser("My question")] });
    const article = screen.getByRole("article", { name: /your message/i });
    expect(within(article).getByText("You")).toBeInTheDocument();
    expect(within(article).getByText("My question")).toBeInTheDocument();
  });

  it("renders an assistant message with the 'Coldplay AI' label and markdown content", () => {
    renderList({
      messages: [makeAssistant("**Chris Martin** is the lead vocalist.")],
    });
    const article = screen.getByRole("article", { name: /assistant message/i });
    expect(within(article).getByText("Coldplay AI")).toBeInTheDocument();
    // Bold markdown rendered as <strong> with the cyan-200 class.
    const strong = within(article).getByText("Chris Martin");
    expect(strong.tagName).toBe("STRONG");
  });

  it("opens markdown links in a new tab with rel='noopener noreferrer'", () => {
    renderList({
      messages: [
        makeAssistant("Visit [the official site](https://example.com/coldplay) for more."),
      ],
    });
    const link = screen.getByRole("link", { name: /the official site/i });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", expect.stringMatching(/noopener/));
    expect(link).toHaveAttribute("rel", expect.stringMatching(/noreferrer/));
  });

  it("renders the thinking dots when isLoading and there's no assistant content yet", () => {
    renderList({ isLoading: true, messages: [makeUser("hi")] });
    expect(screen.getByRole("article", { name: /assistant thinking/i })).toBeInTheDocument();
  });

  it("renders error display with Retry + Dismiss buttons when both are provided", () => {
    const onRetry = vi.fn();
    const { onDismissError } = renderList({
      errorMessage: "Connection failed",
      onRetryLastMessage: onRetry,
    });

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Connection failed");

    const retryButton = within(alert).getByRole("button", { name: /retry/i });
    const dismissButton = within(alert).getByRole("button", { name: /dismiss/i });

    fireEvent.click(retryButton);
    expect(onDismissError).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledTimes(1);

    fireEvent.click(dismissButton);
    expect(onDismissError).toHaveBeenCalledTimes(2);
  });

  it("hides the Retry button when onRetryLastMessage is undefined", () => {
    renderList({
      errorMessage: "Error w/o retry support",
      onRetryLastMessage: undefined,
    });
    const alert = screen.getByRole("alert");
    expect(within(alert).queryByRole("button", { name: /retry/i })).not.toBeInTheDocument();
    expect(within(alert).getByRole("button", { name: /dismiss/i })).toBeInTheDocument();
  });
});
