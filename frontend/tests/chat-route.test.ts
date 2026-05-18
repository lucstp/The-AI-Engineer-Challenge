import { beforeEach, describe, expect, it, vi } from "vitest";

const { cookiesMock } = vi.hoisted(() => ({
  cookiesMock: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: cookiesMock,
}));

import { POST } from "@/app/api/chat/route";
import { seal } from "@/lib/session-crypto";

// Pre-seal the canonical test key once: the cookie store mock returns
// this sealed blob, route handler unseals it, validates, proceeds.
const SEALED_VALID_KEY = seal("sk-valid-cookie-1234567890123456789");

function createCookieStore(value?: string) {
  return {
    get: vi.fn(() => (value ? { value } : undefined)),
  };
}

function makeJsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // Same-origin guard requires Origin to match request URL's
      // protocol+host. Matches the URL above.
      Origin: "http://localhost",
    },
    body: JSON.stringify(body),
  });
}

function createSseResponse(chunks: string[], status = 200): Response {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    status,
    headers: { "Content-Type": "text/event-stream" },
  });
}

describe("app/api/chat/route", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    cookiesMock.mockReset();
    vi.stubGlobal("fetch", vi.fn());
    vi.spyOn(crypto, "randomUUID").mockReturnValue("req-fixed-123");
  });

  it("rejects cross-origin POSTs with 403 (CSRF defense-in-depth)", async () => {
    const crossOriginRequest = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://evil.example.com",
      },
      body: JSON.stringify({ message: "Hello" }),
    });

    const response = await POST(crossOriginRequest);
    expect(response.status).toBe(403);
  });

  it("rejects requests with no Origin header (server-to-server probes)", async () => {
    const originlessRequest = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Hello" }),
    });

    const response = await POST(originlessRequest);
    expect(response.status).toBe(403);
  });

  it("returns 401 when api key cookie is missing", async () => {
    cookiesMock.mockResolvedValue(createCookieStore());

    const response = await POST(makeJsonRequest({ message: "Hello" }));
    const payload = (await response.json()) as { detail: string };

    expect(response.status).toBe(401);
    expect(payload.detail).toContain("OpenAI key not verified");
    expect(response.headers.get("x-request-id")).toBe("req-fixed-123");
  });

  it("returns 400 when message is empty", async () => {
    cookiesMock.mockResolvedValue(createCookieStore(SEALED_VALID_KEY));

    const response = await POST(makeJsonRequest({ message: "   " }));
    const payload = (await response.json()) as { detail: string };

    expect(response.status).toBe(400);
    expect(payload.detail).toContain("Message cannot be empty");
  });

  it("streams assistant text from OpenAI SSE chunks", async () => {
    cookiesMock.mockResolvedValue(createCookieStore(SEALED_VALID_KEY));
    vi.mocked(fetch).mockResolvedValue(
      createSseResponse([
        'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":" world"}}]}\n\n',
        "data: [DONE]\n\n",
      ])
    );

    const response = await POST(makeJsonRequest({ message: "Say hello" }));
    const responseText = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/plain");
    expect(responseText).toBe("Hello world");
  });

  it("maps OpenAI error payloads and propagates request id", async () => {
    cookiesMock.mockResolvedValue(createCookieStore(SEALED_VALID_KEY));
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ error: { message: "The model is currently overloaded." } }), {
        status: 429,
        headers: { "Content-Type": "application/json" },
      })
    );

    const response = await POST(makeJsonRequest({ message: "Anything" }));
    const payload = (await response.json()) as { detail: string };

    expect(response.status).toBe(429);
    expect(payload.detail).toContain("overloaded");
    // request_id is propagated via the x-request-id response header, not
    // inlined in the body — assert the actual channel of communication.
    expect(response.headers.get("x-request-id")).toBe("req-fixed-123");
  });

  it("returns 504 when upstream request is aborted", async () => {
    cookiesMock.mockResolvedValue(createCookieStore(SEALED_VALID_KEY));
    vi.mocked(fetch).mockRejectedValue(new DOMException("aborted", "AbortError"));

    const response = await POST(makeJsonRequest({ message: "Anything" }));
    const payload = (await response.json()) as { detail: string };

    expect(response.status).toBe(504);
    expect(payload.detail).toContain("timed out");
  });

  it("forwards a valid allowlisted model to OpenAI with its per-model token cap", async () => {
    cookiesMock.mockResolvedValue(createCookieStore(SEALED_VALID_KEY));
    vi.mocked(fetch).mockResolvedValue(
      createSseResponse(['data: {"choices":[{"delta":{"content":"Hi"}}]}\n\n', "data: [DONE]\n\n"])
    );

    const response = await POST(makeJsonRequest({ message: "Hello", model: "gpt-5" }));
    expect(response.status).toBe(200);

    // Assert the upstream call used the validated model + per-model cap.
    const fetchCall = vi.mocked(fetch).mock.calls[0];
    expect(fetchCall).toBeDefined();
    const requestInit = fetchCall?.[1] as RequestInit | undefined;
    expect(requestInit?.body).toBeTypeOf("string");
    const body = JSON.parse(requestInit?.body as string) as {
      model: string;
      max_completion_tokens: number;
    };
    expect(body.model).toBe("gpt-5");
    expect(body.max_completion_tokens).toBe(4000);
  });

  it("returns 400 for a model outside the allowlist (zod reject)", async () => {
    cookiesMock.mockResolvedValue(createCookieStore(SEALED_VALID_KEY));

    const response = await POST(makeJsonRequest({ message: "Hello", model: "gpt-3" }));
    const payload = (await response.json()) as { detail: string };

    expect(response.status).toBe(400);
    expect(payload.detail).toMatch(/invalid|enum|model/i);
  });

  it("falls back to env's OPENAI_MODEL when request omits `model`", async () => {
    cookiesMock.mockResolvedValue(createCookieStore(SEALED_VALID_KEY));
    vi.mocked(fetch).mockResolvedValue(
      createSseResponse(['data: {"choices":[{"delta":{"content":"Hi"}}]}\n\n', "data: [DONE]\n\n"])
    );

    const response = await POST(makeJsonRequest({ message: "Hello" }));
    expect(response.status).toBe(200);

    const fetchCall = vi.mocked(fetch).mock.calls[0];
    const requestInit = fetchCall?.[1] as RequestInit | undefined;
    const body = JSON.parse(requestInit?.body as string) as { model: string };
    // tests/global-setup.ts leaves OPENAI_MODEL at its env schema default
    // ("gpt-4.1-mini") — that fallback path keeps legacy/non-UI callers working.
    expect(body.model).toBe("gpt-4.1-mini");
  });
});
