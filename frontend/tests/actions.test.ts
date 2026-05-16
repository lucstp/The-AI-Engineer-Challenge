import { beforeEach, describe, expect, it, vi } from "vitest";

const { cookiesMock } = vi.hoisted(() => ({
  cookiesMock: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: cookiesMock,
}));

import { clearVerifiedKeyAction, hasVerifiedKeyAction } from "@/app/actions";
import { seal } from "@/lib/session-crypto";

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
