/**
 * Lighthouse CI pre-audit hook — sets the Vercel Deployment Protection
 * bypass cookie BEFORE the audit fires, so the audit itself can run
 * without sending cross-origin-polluting `extraHeaders`.
 *
 * Wired in `.lighthouserc.cjs` via `collect.puppeteerScript`. lhci runs
 * this with `(browser, context) => Promise<void>` and shares the browser
 * instance with the subsequent audit — cookies set here persist into
 * the audit phase.
 *
 * ── Why this approach (the architectural root-cause fix) ────────────
 *
 * The previous setup passed `x-vercel-protection-bypass` via
 * `extraHeaders` in the Lighthouse config. That attaches the header
 * to EVERY request the browser makes during the audit — including
 * cross-origin fetches to Sentry's ingest endpoint
 * (`o<id>.ingest.us.sentry.io`). Sentry doesn't whitelist the Vercel-
 * specific header in its CORS preflight response (it has no reason
 * to — that header is internal Vercel infrastructure), so every
 * preflight failed → every Sentry event POST was blocked → six
 * console errors per Lighthouse run → Best Practices stuck at 93.
 *
 * The fix is to switch auth primitives:
 *   • Custom HTTP headers are GLOBALLY scoped — the browser attaches
 *     them to every outbound request regardless of origin. Wrong tool.
 *   • Cookies are ORIGIN-scoped by the browser, by definition. Right
 *     tool. Vercel ships a cookie-based bypass specifically for this
 *     scenario (`x-vercel-set-bypass-cookie`).
 *
 * Auth flow:
 *   1. We navigate to `<url>?x-vercel-protection-bypass=<secret>&x-vercel-set-bypass-cookie=true`
 *   2. Vercel validates the secret, mints a `_vercel_jwt` cookie
 *      scoped to the deployment origin, 307-redirects to the clean URL
 *   3. The browser now has the cookie for that origin
 *   4. Lighthouse's actual audit runs against the clean URL — the
 *      cookie authenticates each request automatically
 *   5. Cross-origin fetches (Sentry) DON'T carry the cookie (browser-
 *      enforced same-origin rule for default-credentials fetches),
 *      so CORS preflight is unencumbered → Sentry events flow → no
 *      console errors
 *
 * Required env var: `VERCEL_AUTOMATION_BYPASS_SECRET` (set in the
 * GitHub Actions workflow from the repo secret of the same name).
 * Failing loudly if absent keeps a silently-broken audit from
 * scoring a Vercel SSO login page and reporting that as "the app."
 */
module.exports = async (browser, context) => {
  const bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  if (!bypassSecret) {
    throw new Error(
      "VERCEL_AUTOMATION_BYPASS_SECRET env var is required for Lighthouse to authenticate against the protected per-deploy URL. Set it as a GitHub Actions secret and expose it to the workflow step that runs treosh/lighthouse-ci-action."
    );
  }

  // Build the bypass-cookie-setting URL. Query params are removed from
  // the URL on Vercel's redirect, so they don't leak into the
  // Lighthouse report's "audited URL" field (which would otherwise
  // expose the secret via the temporary-public-storage report link).
  const bypassUrl = new URL(context.url);
  bypassUrl.searchParams.set("x-vercel-protection-bypass", bypassSecret);
  bypassUrl.searchParams.set("x-vercel-set-bypass-cookie", "true");

  // `networkidle2` waits for at most 2 in-flight requests over a 500ms
  // window — long enough for the redirect chain + Set-Cookie to land,
  // not so long that we hog the audit's time budget. Returning before
  // the cookie is set would race the audit; networkidle2 is the
  // canonical signal that the navigation has fully settled.
  const page = await browser.newPage();
  await page.goto(bypassUrl.toString(), { waitUntil: "networkidle2" });
  await page.close();
};
