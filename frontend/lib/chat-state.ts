import type { ChatMessage } from "@/lib/chat-types";

interface CreateMessageOptions {
  animate?: boolean;
  createdAt?: number;
  typingMs?: number;
}

export function createMessageId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createUserMessage(
  content: string,
  options: CreateMessageOptions = {}
): ChatMessage {
  return {
    id: createMessageId(),
    role: "user",
    content,
    createdAt: options.createdAt ?? Date.now(),
  };
}

export function createAssistantMessage(
  content: string,
  options: CreateMessageOptions = {}
): ChatMessage {
  return {
    id: createMessageId(),
    role: "assistant",
    content,
    createdAt: options.createdAt ?? Date.now(),
    animate: options.animate ?? true,
    typingMs: options.typingMs,
  };
}

export function completeAssistantAnimation(
  messages: ChatMessage[],
  messageId: string
): ChatMessage[] {
  return messages.map((message) =>
    message.id === messageId ? { ...message, animate: false } : message
  );
}
