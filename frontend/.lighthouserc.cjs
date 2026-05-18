/**
 * Lighthouse CI config — JS form (not JSON), because:
 *
 *  1. The Vercel bypass secret must be templated at run time from
 *     env so it never ends up in the committed repo. JSON has no
 *     way to read env vars.
 *
 *  2. JSON has no comments. An earlier `.lighthouserc.json` used
 *     `_comment_*` pseudo-keys for inline notes which Lighthouse
 *     interpreted as audit names → `auditRan` warnings on every run.
 *     JS comments are real and free.
 *
 * Consumed by `.github/workflows/lighthouse.yml` via
 * `treosh/lighthouse-ci-action`. Schema reference:
 *   https://github.com/GoogleChrome/lighthouse-ci/blob/main/docs/configuration.md
 *
 * ── Auth: cookie-based, not header-based ─────────────────────────────
 *
 * Vercel Deployment Protection requires authentication on the per-deploy
 * URLs Lighthouse audits. We authenticate via `lighthouse-prepare.cjs`
 * (a puppeteerScript run before the audit) which navigates to a
 * bypass-cookie-setting URL. Vercel mints a `_vercel_jwt` cookie
 * scoped to the deployment origin, and Lighthouse's audit then uses
 * that cookie automatically.
 *
 * Cookies are origin-scoped by the browser, so cross-origin requests
 * (Sentry ingest, Vercel telemetry, etc.) DON'T carry the auth — no
 * CORS preflight pollution. This is what `extraHeaders` got wrong:
 * global header injection forces the auth onto every cross-origin
 * request, which breaks Sentry's preflight (Sentry doesn't whitelist
 * Vercel's internal `x-vercel-protection-bypass` header → preflight
 * fails → six console errors per audit).
 */

module.exports = {
  ci: {
    collect: {
      numberOfRuns: 1,
      // Pre-audit hook — sets the Vercel bypass cookie on the
      // deployment origin so the audit itself can run without
      // attaching the bypass header to outbound cross-origin requests.
      // See `lighthouse-prepare.cjs` for the rationale.
      puppeteerScript: "./lighthouse-prepare.cjs",
      settings: {
        // Desktop preset matches the primary surface for an LLM chat
        // app; mobile-first projects would flip to the mobile preset.
        preset: "desktop",
        // Skip PWA-only audits — this app isn't a PWA (LLM chat
        // needs network, no service-worker offline story to ship).
        skipAudits: ["service-worker", "installable-manifest"],
      },
    },
    assert: {
      assertions: {
        // Hard error. Accessibility regressions block merges — a11y
        // is a contract, not a preference. WCAG 2.1 AA bar.
        "categories:accessibility": ["error", { minScore: 0.95 }],
        // Warning. Performance scores are network-sensitive and vary
        // 5-15 points run-to-run on GitHub-hosted runners. Hard-
        // gating perf produces flaky CI without surfacing real
        // regressions.
        "categories:performance": ["warn", { minScore: 0.85 }],
        // Warning. Best-practices catches HTTPS, console errors,
        // vulnerable libs.
        "categories:best-practices": ["warn", { minScore: 0.9 }],
        // Disabled. The site is intentionally `robots: noindex` per
        // the fair-use posture documented in the README, so an SEO
        // score in the 60s is expected and not actionable.
        "categories:seo": "off",
        // Disabled. Not a PWA by design (see `skipAudits` above).
        "categories:pwa": "off",
      },
    },
    upload: {
      target: "temporary-public-storage",
    },
  },
};
