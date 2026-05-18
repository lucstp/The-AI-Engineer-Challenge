"use client";

import { Volume2, VolumeX } from "lucide-react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface SoundToggleProps {
  isEnabled: boolean;
  onToggle: () => void;
}

/**
 * Compact mute / unmute pill for the chat-shell header. Same shape
 * vocabulary as the Disconnect button so they sit naturally side by
 * side. Aria state reflects the *current* posture (pressed = sound on).
 */
export function SoundToggle({ isEnabled, onToggle }: SoundToggleProps) {
  const label = isEnabled ? "Mute ambient sound" : "Enable ambient sound";
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onToggle}
          aria-pressed={isEnabled}
          aria-label={label}
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/22 bg-white/4 text-white/85 transition hover:bg-white/10 sm:h-8 sm:w-8"
        >
          {isEnabled ? (
            <Volume2 aria-hidden className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          ) : (
            <VolumeX aria-hidden className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
