import { ChatMessage } from "@/lib/chat-types";

export function createMessageId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createUserMessage(content: string): ChatMessage {
  return {
    id: createMessageId(),
    role: "user",
    content
  };
}

export function createAssistantMessage(content: string): ChatMessage {
  return {
    id: createMessageId(),
    role: "assistant",
    content,
    animate: true
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
