import type { ModelId } from "@/lib/constants";
import { chatErrorResponseSchema, chatRequestSchema } from "@/lib/schemas";

const STREAMING_ENDPOINT = "/api/chat";

export interface ChatRequest {
  message: string;
  model?: ModelId;
}

interface StreamChatOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
  onChunk: (chunk: string) => void;
  /** Optional model override — falls back to the server's env default if absent. */
  model?: ModelId;
}

export class ChatApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number
  ) {
    super(message);
    this.name = "ChatApiError";
  }
}

/**
 * Stream chat completions through the Next.js `/api/chat` route handler.
 * The route forwards server-side to OpenAI and pipes plain-text content
 * deltas back. Each chunk is delivered to `onChunk` as it arrives; the
 * promise resolves once the upstream stream closes.
 */
export async function streamChatMessage(
  message: string,
  options: StreamChatOptions
): Promise<void> {
  const parsed = chatRequestSchema.safeParse({ message, model: options.model });
  if (!parsed.success) {
    throw new ChatApiError(
      parsed.error.issues[0]?.message ?? "Please write a message before sending."
    );
  }

  // Aligned with the server-side 60s OpenAI timeout + 5s slack for the
  // final network leg back to the browser.
  const timeoutMs = options.timeoutMs ?? 65_000;
  const timeoutController = new AbortController();
  const combinedSignal = mergeAbortSignals(options.signal, timeoutController.signal);
  const timeoutHandle = window.setTimeout(() => timeoutController.abort(), timeoutMs);

  try {
    const response = await fetch(STREAMING_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data),
      signal: combinedSignal,
    });

    if (!response.ok) {
      const details = (await tryReadErrorDetail(response)) ?? "Unexpected server response.";
      throw new ChatApiError(details, response.status);
    }

    if (!response.body) {
      throw new ChatApiError("The chat service did not return a response stream.");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      if (value) {
        const chunk = decoder.decode(value, { stream: true });
        if (chunk.length > 0) {
          options.onChunk(chunk);
        }
      }
    }
  } catch (error) {
    if (error instanceof ChatApiError) {
      throw error;
    }
    if (error instanceof DOMException && error.name === "AbortError") {
      if (options.signal?.aborted) {
        throw new ChatApiError("Request cancelled.");
      }
      throw new ChatApiError(
        `The request timed out after ${Math.round(timeoutMs / 1000)} seconds.`
      );
    }
    throw new ChatApiError("Unable to reach the chat service. Please try again in a moment.");
  } finally {
    window.clearTimeout(timeoutHandle);
  }
}

async function tryReadErrorDetail(response: Response): Promise<string | null> {
  try {
    const raw = await response.json();
    const parsed = chatErrorResponseSchema.safeParse(raw);
    return parsed.success ? parsed.data.detail : null;
  } catch {
    return null;
  }
}

function mergeAbortSignals(
  primarySignal: AbortSignal | undefined,
  secondarySignal: AbortSignal
): AbortSignal {
  if (!primarySignal) {
    return secondarySignal;
  }

  const controller = new AbortController();
  const abort = () => controller.abort();

  if (primarySignal.aborted || secondarySignal.aborted) {
    controller.abort();
    return controller.signal;
  }

  primarySignal.addEventListener("abort", abort, { once: true });
  secondarySignal.addEventListener("abort", abort, { once: true });
  return controller.signal;
}
