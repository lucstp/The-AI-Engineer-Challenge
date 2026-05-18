"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DEFAULT_MODEL, MODELS, type ModelId } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface ModelSelectorProps {
  selectedModel: ModelId;
  onModelChange: (modelId: ModelId) => void;
  disabled?: boolean;
  className?: string;
}

export function ModelSelector({
  selectedModel,
  onModelChange,
  disabled,
  className,
}: ModelSelectorProps) {
  const currentModel = MODELS.find((m) => m.id === selectedModel) ?? MODELS[0];

  return (
    <Select
      value={selectedModel ?? DEFAULT_MODEL}
      onValueChange={(value) => onModelChange(value as ModelId)}
      disabled={disabled}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <SelectTrigger
            aria-label="Choose model"
            className={cn(
              "h-9 w-auto min-w-0 gap-1 rounded-full border-white/15 bg-white/5 px-3 font-medium text-xs",
              "transition-colors duration-200 hover:bg-white/10",
              className
            )}
          >
            <SelectValue placeholder="Model" />
          </SelectTrigger>
        </TooltipTrigger>
        <TooltipContent side="top">
          <span className="font-medium">{currentModel.name}</span>
          <span className="ml-1 font-mono text-white/55">({currentModel.id})</span>
          <span className="mt-0.5 block text-white/70">{currentModel.description}</span>
        </TooltipContent>
      </Tooltip>
      <SelectContent>
        {MODELS.map((model) => (
          <SelectItem
            key={model.id}
            value={model.id}
            version={model.id}
            description={model.description}
          >
            {model.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
