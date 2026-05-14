import { beforeEach, describe, expect, it, vi } from "vitest";

const { cookiesMock } = vi.hoisted(() => ({
  cookiesMock: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: cookiesMock,
}));

import { clearVerifiedKeyAction, hasVerifiedKeyAction, verifyOpenAiKeyAction } from "@/app/actions";
import { seal, unseal } from "@/lib/session-crypto";

function createCookieStore(initialValue?: string) {
  return {
    get: vi.fn((name: string) => {
      if (name !== "openai_api_key") {
        return undefined;
      }
      return initialValue ? { value: initialValue } : undefined;
    }),
    set: vi.fn(),
    delete: vi.fn(),
  };
}

describe("app/actions", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    cookiesMock.mockReset();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("rejects obviously invalid key formats without network call", async () => {
    const result = await verifyOpenAiKeyAction("not-a-key");

    expect(result.ok).toBe(false);
    expect(result.message).toContain("Invalid key format");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("stores key sealed (AES-256-GCM) in a secure httpOnly strict cookie on successful verification", async () => {
    const cookieStore = createCookieStore();
    cookiesMock.mockResolvedValue(cookieStore);
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 200 }));

    const rawKey = "sk-valid-key-12345678901234567890";
    const result = await verifyOpenAiKeyAction(rawKey);

    expect(result.ok).toBe(true);
    expect(cookieStore.set).toHaveBeenCalledWith(
      "openai_api_key",
      expect.any(String),
      expect.objectContaining({
        httpOnly: true,
        sameSite: "strict",
        path: "/",
      })
    );
    // Stored value must be the sealed form, never the raw key. Verifies
    // the H2 invariant: raw key never lands in the cookie jar.
    const storedValue = cookieStore.set.mock.calls[0]?.[1] as string;
    expect(storedValue).not.toBe(rawKey);
    expect(storedValue.split(".").length).toBe(3);
    expect(unseal(storedValue)).toBe(rawKey);
  });

  it("returns explicit auth failure for revoked or invalid keys", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 401 }));

    const result = await verifyOpenAiKeyAction("sk-invalid-key-12345678901234567890");

    expect(result.ok).toBe(false);
    expect(result.message).toContain("invalid, revoked, or expired");
  });

  it("treats 429 as recognized key but warns about limits", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 429 }));

    const result = await verifyOpenAiKeyAction("sk-rate-limited-key-123456789012345");

    expect(result.ok).toBe(true);
    expect(result.message).toContain("rate-limited");
  });

  it("returns network failure guidance when OpenAI cannot be reached", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("socket hang up"));

    const result = await verifyOpenAiKeyAction("sk-network-fail-key-1234567890123456");

    expect(result.ok).toBe(false);
    expect(result.message).toContain("Could not reach OpenAI");
  });

  it("detects whether a plausible verified key cookie exists (sealed form)", async () => {
    const cookieStore = createCookieStore(seal("sk-cookie-key-12345678901234567890"));
    cookiesMock.mockResolvedValue(cookieStore);

    await expect(hasVerifiedKeyAction()).resolves.toBe(true);
  });

  it("rejects a tampered or wrong-secret cookie value", async () => {
    // Raw key with no seal → unseal() returns null → action says no key.
    const cookieStore = createCookieStore("sk-cookie-key-not-sealed-no-good");
    cookiesMock.mockResolvedValue(cookieStore);

    await expect(hasVerifiedKeyAction()).resolves.toBe(false);
  });

  it("returns false when no verified key cookie exists", async () => {
    const cookieStore = createCookieStore();
    cookiesMock.mockResolvedValue(cookieStore);

    await expect(hasVerifiedKeyAction()).resolves.toBe(false);
  });

  it("clears the verified key cookie", async () => {
    const cookieStore = createCookieStore("sk-cookie-key-12345678901234567890");
    cookiesMock.mockResolvedValue(cookieStore);

    await clearVerifiedKeyAction();

    expect(cookieStore.delete).toHaveBeenCalledWith("openai_api_key");
  });
});
