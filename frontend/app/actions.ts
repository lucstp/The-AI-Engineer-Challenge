"use server";

export interface VerifyKeyResult {
  ok: boolean;
  message: string;
}

export async function verifyOpenAiKeyAction(rawKey: string): Promise<VerifyKeyResult> {
  const key = rawKey.trim();
  if (!isPlausibleOpenAiKey(key)) {
    return {
      ok: false,
      message: "Invalid key format. OpenAI keys usually start with 'sk-' and are longer."
    };
  }

  try {
    const response = await fetch("https://api.openai.com/v1/models", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${key}`
      },
      cache: "no-store"
    });

    if (response.ok) {
      return { ok: true, message: "Key verified. You can start chatting." };
    }

    if (response.status === 401) {
      return {
        ok: false,
        message: "This key is invalid, revoked, or expired. Please check and try again."
      };
    }

    if (response.status === 429) {
      return {
        ok: true,
        message:
          "Key is recognized, but your account appears rate-limited right now. Chat may still fail until limits reset."
      };
    }

    return {
      ok: false,
      message: `Validation failed with status ${response.status}. Please retry in a moment.`
    };
  } catch {
    return {
      ok: false,
      message: "Could not reach OpenAI for validation. Check your network and try again."
    };
  }
}

function isPlausibleOpenAiKey(value: string): boolean {
  if (!value.startsWith("sk-")) {
    return false;
  }

  return value.length >= 24 && value.length <= 256;
}
