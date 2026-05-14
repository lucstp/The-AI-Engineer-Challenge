import path from "node:path";

import { expect, test } from "@playwright/test";

import { seal } from "@/lib/session-crypto";
import { TEST_BASE_URL } from "../global-setup";

/**
 * Cross-breakpoint visual audit. Captures locked + verified states at the
 * pinned viewport for the running project (see responsive.config.ts).
 *
 * Output: tests/responsive/screenshots/{projectName}-{state}.png
 */

const KEY_COOKIE_NAME = "openai_api_key";
const KEY_COOKIE_VALUE = seal("sk-responsive-cookie-key-12345678901234567890");
const SCREENSHOT_DIR = path.join(__dirname, "screenshots");

test.describe("responsive audit", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/chat", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "text/plain; charset=utf-8",
        body: "Synthetic assistant reply.",
      });
    });
  });

  test("locked + verified frames", async ({ context, page }, testInfo) => {
    const projectName = testInfo.project.name;

    // ── Locked state ─────────────────────────────────────────────────────
    await page.goto("/");
    await expect(page.getByRole("region", { name: "OpenAI key verification" })).toBeVisible();
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, `${projectName}-01-locked.png`),
      fullPage: true,
    });

    // ── Verified state (welcome) ─────────────────────────────────────────
    await context.addCookies([
      {
        name: KEY_COOKIE_NAME,
        value: KEY_COOKIE_VALUE,
        url: TEST_BASE_URL,
        httpOnly: true,
        sameSite: "Strict",
      },
    ]);
    await page.reload();
    await expect(page.locator("#chat-input")).toBeVisible();
    // Welcome typewriter is ~2.2s; allow margin.
    await page.waitForTimeout(2800);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, `${projectName}-02-verified.png`),
      fullPage: true,
    });
  });
});
