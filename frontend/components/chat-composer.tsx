import { FormEvent, KeyboardEvent } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface ChatComposerProps {
  value: string;
  isLoading: boolean;
  isDisabled: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onStop: () => void;
}

export function ChatComposer({
  value,
  isLoading,
  isDisabled,
  onChange,
  onSubmit,
  onStop
}: ChatComposerProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      onSubmit();
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_auto] md:gap-3"
    >
      <Label htmlFor="chat-input" className="sr-only">
        Type your message
      </Label>
      <Textarea
        id="chat-input"
        name="chat-input"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={
          isDisabled
            ? "Verify your OpenAI key above to start chatting."
            : "Ask about Coldplay... (Enter to send, Shift+Enter for newline)"
        }
        rows={2}
        disabled={isLoading || isDisabled}
        className="max-h-40"
      />
      <div className="flex items-end">
        {isLoading ? (
          <Button
            type="button"
            variant="destructive"
            onClick={onStop}
            aria-label="Stop current assistant response"
            className="w-full md:w-auto"
          >
            Stop
          </Button>
        ) : (
          <Button
            type="submit"
            disabled={isDisabled || !value.trim()}
            aria-label="Send message"
            className="w-full md:w-auto"
          >
            Send
          </Button>
        )}
      </div>
    </form>
  );
}
