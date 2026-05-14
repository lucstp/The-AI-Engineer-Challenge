import { expect, test } from "@playwright/test";

import { seal } from "@/lib/session-crypto";
import { TEST_BASE_URL } from "../global-setup";

const KEY_COOKIE_NAME = "openai_api_key";
// Seal at test setup with the TEST_SESSION_SECRET that globalSetup pinned
// into process.env. Server (started by Playwright with the same secret
// via webServer.env) will unseal successfully.
const KEY_COOKIE_VALUE = seal("sk-playwright-cookie-key-12345678901234567890");
const CHAT_STATE_STORAGE_KEY = "coldplay_chat_ui_state_v1";
const CHAT_SCROLL_STORAGE_KEY = "coldplay_chat_scroll_top_v1";

test.beforeEach(async ({ context, page }) => {
  await context.addCookies([
    {
      name: KEY_COOKIE_NAME,
      value: KEY_COOKIE_VALUE,
      url: TEST_BASE_URL,
      httpOnly: true,
      sameSite: "Strict",
    },
  ]);

  await page.route("**/api/chat", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/plain; charset=utf-8",
      body: "Playwright synthetic response.",
    });
  });
});

test("refresh restores messages, draft input, and conversation scroll", async ({ page }) => {
  await page.goto("/");

  await page.evaluate(
    ({ stateKey, scrollKey }) => {
      const baseTime = Date.now() - 80_000;
      const messages = Array.from({ length: 80 }, (_, index) => ({
        id: `msg-${index}`,
        role: index % 2 === 0 ? "user" : "assistant",
        content: `Persisted message ${index} — long content to ensure overflow and scroll behavior.`,
        createdAt: baseTime + index * 1000,
      }));

      window.sessionStorage.setItem(
        stateKey,
        JSON.stringify({
          messages,
          inputValue: "Draft should survive refresh",
        })
      );
      window.sessionStorage.setItem(scrollKey, "420");
    },
    { stateKey: CHAT_STATE_STORAGE_KEY, scrollKey: CHAT_SCROLL_STORAGE_KEY }
  );

  await page.reload();

  await expect(page.getByText("Persisted message 79")).toHaveCount(1);
  await expect(page.locator("#chat-input")).toHaveValue("Draft should survive refresh");

  const conversation = page.locator('section[aria-label="Conversation"]');
  await expect
    .poll(async () => {
      return conversation.evaluate((node) => Math.round(node.scrollTop));
    })
    .toBeGreaterThan(300);

  await conversation.evaluate((node) => {
    node.scrollTop = 560;
    node.dispatchEvent(new Event("scroll", { bubbles: true }));
  });

  await page.reload();

  await expect
    .poll(async () => {
      return conversation.evaluate((node) => Math.round(node.scrollTop));
    })
    .toBeGreaterThan(500);
});

test("disconnect clears cookie-backed session state and client persistence", async ({ page }) => {
  await page.goto("/");

  await page.evaluate(
    ({ stateKey, scrollKey }) => {
      const now = Date.now();
      window.sessionStorage.setItem(
        stateKey,
        JSON.stringify({
          // Welcome-injection wipes assistant-only state and replays the
          // typewriter; a real conversation always has a user turn, so we
          // seed both roles to mirror production shape.
          messages: [
            {
              id: "persisted-user-1",
              role: "user",
              content: "User turn so welcome-injection leaves state alone.",
              createdAt: now - 1000,
            },
            {
              id: "persisted-1",
              role: "assistant",
              content: "Persisted text to clear.",
              createdAt: now,
            },
          ],
          inputValue: "Draft to clear.",
        })
      );
      window.sessionStorage.setItem(scrollKey, "200");
    },
    { stateKey: CHAT_STATE_STORAGE_KEY, scrollKey: CHAT_SCROLL_STORAGE_KEY }
  );

  await page.reload();
  await expect(page.getByText("Persisted text to clear.")).toHaveCount(1);

  await page.getByRole("button", { name: "Disconnect verified key" }).click();

  await expect(
    page.getByText("Secure key session cleared. Please verify a key to continue.")
  ).toBeVisible();
  await expect(page.getByRole("region", { name: "OpenAI key verification" })).toBeVisible();

  await page.reload();

  await expect(page.getByText("Persisted text to clear.")).toHaveCount(0);
  // Locked state has no chat composer; confirming absence is the new shape
  // of the "draft did not survive" assertion.
  await expect(page.locator("#chat-input")).toHaveCount(0);

  const storageState = await page.evaluate(
    ({ stateKey, scrollKey }) => ({
      chat: window.sessionStorage.getItem(stateKey),
      scroll: window.sessionStorage.getItem(scrollKey),
    }),
    { stateKey: CHAT_STATE_STORAGE_KEY, scrollKey: CHAT_SCROLL_STORAGE_KEY }
  );

  if (storageState.chat !== null) {
    expect(JSON.parse(storageState.chat)).toEqual({
      messages: [],
      inputValue: "",
    });
  }
  expect(storageState.scroll).toBeNull();
});
