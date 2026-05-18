import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { seal } from "@/lib/session-crypto";
import { TEST_BASE_URL } from "../global-setup";

/**
 * Continuous a11y regression coverage. axe-core scans the rendered DOM
 * for WCAG 2.1 A / AA failures (color contrast, landmark structure,
 * ARIA misuse, focus traps, etc.) on every PR.
 *
 * Tag convention: every test in this file is tagged `@a11y` so a focused
 * run is one command — `pnpm exec playwright test --grep @a11y`.
 *
 * Coverage strategy: both surfaces (locked + unlocked) get scanned
 * because each renders a different DOM tree with its own potential
 * regressions. Locked is what every first-time visitor sees;
 * unlocked is where the user actually spends time.
 *
 * Tag scoping: axe runs every WCAG 2.1 AA rule that's relevant to the
 * markup we ship. Best-practice rules are enabled too so we catch
 * regressions before they reach the WCAG bar. If a particular rule
 * fires on third-party-library markup we don't control, we disable
 * it explicitly here with `.disableRules([...])` — the alternative
 * (silencing axe globally) hides real signal.
 */

const KEY_COOKIE_NAME = "openai_api_key";
const KEY_COOKIE_VALUE = seal("sk-playwright-cookie-key-12345678901234567890");

test.describe("a11y @a11y", () => {
  test("locked landing page has no detectable WCAG 2.1 AA violations", async ({ page }) => {
    await page.goto("/");

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"])
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test("unlocked chat shell has no detectable WCAG 2.1 AA violations", async ({
    context,
    page,
  }) => {
    // Seal a verified-key cookie so the chat shell renders the unlocked
    // surface — same pattern as `session-persistence.spec.ts` so a single
    // SESSION_SECRET pin (set by global-setup) decrypts both flows.
    await context.addCookies([
      {
        name: KEY_COOKIE_NAME,
        value: KEY_COOKIE_VALUE,
        url: TEST_BASE_URL,
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);

    await page.goto("/");

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"])
      .analyze();

    expect(results.violations).toEqual([]);
  });
});
