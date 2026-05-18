import { ArrowUp, Sparkles } from "lucide-react";
import type { FormEvent, KeyboardEvent } from "react";

import { ModelSelector } from "@/components/chat/model-selector";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { ModelId } from "@/lib/chat-types";
import { fireOnUserAction } from "@/lib/confetti";

interface ChatComposerProps {
  value: string;
  isLoading: boolean;
  isDisabled: boolean;
  selectedModel: ModelId;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onStop: () => void;
  onModelChange: (modelId: ModelId) => void;
}

const QUICK_COLDPLAY_PROMPTS = [
  "Give me a short story behind 'Fix You'.",
  "What's the emotional arc of A Rush of Blood to the Head?",
  "Build me a 5-song Coldplay playlist for a night drive.",
  "Which Coldplay songs are best for healing after a hard day?",
  "Explain Moon Music in a concise, poetic way.",
];

export function ChatComposer({
  value,
  isLoading,
  isDisabled,
  selectedModel,
  onChange,
  onSubmit,
  onStop,
  onModelChange,
}: ChatComposerProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isDisabled && value.trim().length > 0 && !isLoading) {
      fireOnUserAction();
    }
    onSubmit();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (!isDisabled && value.trim().length > 0 && !isLoading) {
        fireOnUserAction();
      }
      onSubmit();
    }
  }

  function insertRandomPrompt() {
    const availablePrompts = QUICK_COLDPLAY_PROMPTS.filter((prompt) => prompt !== value.trim());
    const source = availablePrompts.length > 0 ? availablePrompts : QUICK_COLDPLAY_PROMPTS;
    const randomPrompt = source[Math.floor(Math.random() * source.length)];
    if (randomPrompt !== undefined) {
      onChange(randomPrompt);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={
        isDisabled
          ? "composer-shell opacity-55 transition-opacity duration-200"
          : "composer-shell transition-opacity duration-200"
      }
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
        placeholder={isDisabled ? "Verify key above to begin" : "Ask about Coldplay..."}
        rows={1}
        disabled={isLoading || isDisabled}
        // `min-h-0` overrides the base Textarea's min-h-[64px] which was
        // forcing the textarea taller than its content — that's what was
        // parking text at the top with dead space below on 2-line wrap.
        // `[field-sizing:content]` (Chrome 123+ / Safari 17.4+ / FF 124+,
        // current at 2026) snaps textarea height to exactly content +
        // padding, eliminating any unused vertical space. The shell's own
        // min-height: 64px keeps the resting size comfortable.
        className="composer-field field-sizing-content max-h-36 min-h-0 resize-none rounded-none border-0 bg-transparent px-4 py-[1.05rem] text-[1.02rem] text-white shadow-none placeholder:text-white/66 focus-visible:border-0 focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
      />
      <div className="composer-tools">
        <ModelSelector
          selectedModel={selectedModel}
          onModelChange={onModelChange}
          disabled={isLoading || isDisabled}
        />
        {!isLoading ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={insertRandomPrompt}
                aria-label="Generate random Coldplay prompt"
                className="composer-magic"
              >
                <Sparkles className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Generate random Coldplay prompt</TooltipContent>
          </Tooltip>
        ) : null}
        {isLoading ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                onClick={onStop}
                aria-label="Stop current assistant response"
                className="composer-stop h-11 rounded-full px-5 font-semibold text-base text-white hover:text-white"
              >
                Stop
              </Button>
            </TooltipTrigger>
            <TooltipContent>Stop streaming response</TooltipContent>
          </Tooltip>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="submit"
                variant="ghost"
                disabled={isDisabled || !value.trim()}
                aria-label="Send message"
                className="composer-send disabled:opacity-100 disabled:brightness-100"
              >
                <ArrowUp
                  strokeWidth={3.5}
                  className="text-white drop-shadow-[0_1px_2px_rgba(2,6,23,0.95)]"
                  style={{ width: 22, height: 22, flexShrink: 0 }}
                />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Send message (Enter)</TooltipContent>
          </Tooltip>
        )}
      </div>
    </form>
  );
}
