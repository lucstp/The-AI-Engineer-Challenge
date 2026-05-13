const DEFAULT_BACKEND_URL = "http://127.0.0.1:8000";

export interface ChatRequest {
  message: string;
}

export interface ChatResponse {
  reply: string;
}

interface SendChatOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
}

export class ChatApiError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = "ChatApiError";
  }
}

export function getBackendBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_BACKEND_URL?.trim();
  return configured && configured.length > 0 ? configured : DEFAULT_BACKEND_URL;
}

export async function sendChatMessage(
  message: string,
  options: SendChatOptions = {}
): Promise<ChatResponse> {
  const trimmedMessage = message.trim();
  if (!trimmedMessage) {
    throw new ChatApiError("Please write a message before sending.");
  }

  const backendBaseUrl = getBackendBaseUrl();
  const endpoint = `${backendBaseUrl}/api/chat`;
  const timeoutMs = options.timeoutMs ?? 60_000;
  const timeoutController = new AbortController();
  const combinedSignal = mergeAbortSignals(options.signal, timeoutController.signal);
  const timeoutHandle = window.setTimeout(() => timeoutController.abort(), timeoutMs);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ message: trimmedMessage } satisfies ChatRequest),
      signal: combinedSignal
    });

    if (!response.ok) {
      const details = (await tryReadErrorDetail(response)) ?? "Unexpected server response.";
      throw new ChatApiError(details, response.status);
    }

    const data = (await response.json()) as Partial<ChatResponse>;
    if (!data.reply || typeof data.reply !== "string") {
      throw new ChatApiError("The backend returned an invalid response.");
    }

    return { reply: data.reply };
  } catch (error) {
    if (error instanceof ChatApiError) {
      throw error;
    }

    if (error instanceof DOMException && error.name === "AbortError") {
      if (options.signal?.aborted) {
        throw new ChatApiError("Request cancelled.");
      }
      throw new ChatApiError(
        `The request timed out after ${Math.round(timeoutMs / 1000)} seconds. Check that the backend is running and responsive.`
      );
    }

    throw new ChatApiError(
      `Unable to reach the backend at ${endpoint}. Make sure the FastAPI server is running and accessible.`
    );
  } finally {
    window.clearTimeout(timeoutHandle);
  }
}

async function tryReadErrorDetail(response: Response): Promise<string | null> {
  try {
    const json = (await response.json()) as { detail?: unknown };
    if (typeof json.detail === "string" && json.detail.trim().length > 0) {
      return json.detail;
    }
    return null;
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
