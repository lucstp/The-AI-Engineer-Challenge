import path from "node:path";

import { expect, test } from "@playwright/test";

import { seal } from "@/lib/session-crypto";
import { TEST_BASE_URL } from "../global-setup";

/**
 * Manual visual-walkthrough spec. NOT part of the default e2e suite
 * (lives outside `tests/e2e/`). Run explicitly with:
 *
 *   pnpm exec playwright test tests/walkthrough/walkthrough.spec.ts
 *
 * Captures full-page screenshots at every UX milestone so a human (or a
 * multimodal agent) can visually verify the post-WS4/WS5 chat flow:
 *   locked (empty) → locked (key typed) → chat (welcome) → chat (sent) →
 *   chat (assistant reply) → locked (after disconnect)
 */

const KEY_COOKIE_NAME = "openai_api_key";
const KEY_COOKIE_VALUE = seal("sk-walkthrough-cookie-key-12345678901234567890");
const SCREENSHOT_DIR = path.join(__dirname, "screenshots");

const ASSISTANT_REPLY =
  "Coldplay's recent work centers on Music of the Spheres (2021) — an interconnected, cosmically themed cycle — and the ongoing Moon Music continuation. Their live show is also pushing sustainable touring with kinetic floors and recycled materials.";

test.describe("chat-shell visual walkthrough", () => {
  test.beforeEach(async ({ page }) => {
    // Intercept all chat traffic with a deterministic synthetic reply so
    // we never depend on a real OPENAI_API_KEY or upstream latency.
    await page.route("**/api/chat", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "text/plain; charset=utf-8",
        body: ASSISTANT_REPLY,
      });
    });
  });

  test("locked → verified → conversation → disconnect", async ({ context, page }) => {
    // ── 01. Locked, empty ────────────────────────────────────────────────
    await page.goto("/");
    await expect(page.getByRole("region", { name: "OpenAI key verification" })).toBeVisible();
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "01-locked-empty.png"),
      fullPage: true,
    });

    // ── 02. Locked, key typed ────────────────────────────────────────────
    await page.locator("#openai-key").fill("sk-walkthrough-typed-1234567890abcdef");
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "02-locked-with-key.png"),
      fullPage: true,
    });

    // ── 03. Verified state (skip server verify; inject cookie + reload) ──
    // The verify path calls OpenAI server-side, which we cannot mock from
    // the browser. Injecting the cookie + reload lands us in the verified
    // state with the same code path the cookie-restoration flow uses.
    await context.addCookies([
      {
        name: KEY_COOKIE_NAME,
        value: KEY_COOKIE_VALUE,
        url: TEST_BASE_URL,
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);
    await page.reload();

    // Welcome typewriter runs ~2.2s; allow margin before snapping.
    await expect(page.locator("#chat-input")).toBeVisible();
    await page.waitForTimeout(2800);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "03-chat-welcome.png"),
      fullPage: true,
    });

    // ── 04. Composer filled, pre-send ────────────────────────────────────
    await page.locator("#chat-input").fill("Tell me about Coldplay's recent work.");
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "04-composer-filled.png"),
      fullPage: true,
    });

    // ── 05. After send, assistant rendered ───────────────────────────────
    await page.locator("#chat-input").press("Enter");
    await expect(page.getByText("Coldplay's recent work centers on", { exact: false })).toBeVisible(
      { timeout: 10_000 }
    );
    // Brief settle for any tail animation.
    await page.waitForTimeout(600);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "05-conversation.png"),
      fullPage: true,
    });

    // ── 06. After disconnect ─────────────────────────────────────────────
    await page.getByRole("button", { name: "Disconnect verified key" }).click();
    await expect(page.getByText("Session cleared — verify a new key to continue.")).toBeVisible();
    // Allow panel-swap to settle.
    await page.waitForTimeout(400);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "06-locked-after-disconnect.png"),
      fullPage: true,
    });
  });
});
