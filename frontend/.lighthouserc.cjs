/**
 * Lighthouse CI config — JS form (not JSON), because:
 *
 *  1. `VERCEL_AUTOMATION_BYPASS_SECRET` must be templated at run time
 *     so the secret never ends up in the committed repo. JSON has no
 *     way to read env vars.
 *
 *  2. JSON has no comments. The previous `.lighthouserc.json` used
 *     `_comment_*` pseudo-keys which Lighthouse interpreted as audit
 *     names → `auditRan` warnings cluttering every run. JS comments
 *     are real and free.
 *
 * Consumed by `.github/workflows/lighthouse.yml` via
 * `treosh/lighthouse-ci-action`. Schema reference:
 *   https://github.com/GoogleChrome/lighthouse-ci/blob/main/docs/configuration.md
 */

const bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

module.exports = {
  ci: {
    collect: {
      numberOfRuns: 1,
      settings: {
        // Desktop preset matches the primary surface for an LLM chat
        // app; mobile-first projects would flip to the mobile preset.
        preset: "desktop",
        // Skip PWA-only audits — this app isn't a PWA (LLM chat needs
        // network, no service-worker offline story to ship).
        skipAudits: ["service-worker", "installable-manifest"],
        // Vercel Deployment Protection bypass.
        //
        // The secret is provisioned in Vercel project settings →
        // Deployment Protection → Protection Bypass for Automation,
        // then mirrored as a GitHub Actions secret named
        // `VERCEL_AUTOMATION_BYPASS_SECRET`. Without this, Lighthouse
        // hits the Vercel SSO redirect and ends up scoring the
        // vercel.com login page instead of our actual deploy.
        //
        // `x-vercel-set-bypass-cookie: true` makes Vercel mint a
        // session cookie on the first hit so subsequent in-page
        // navigations (CSS, scripts, sub-resources) stay authenticated
        // without re-presenting the header. Without the cookie,
        // resources loaded during the Lighthouse run can hit the SSO
        // redirect even after the initial HTML is fine.
        extraHeaders: bypassSecret
          ? JSON.stringify({
              "x-vercel-protection-bypass": bypassSecret,
              "x-vercel-set-bypass-cookie": "true",
            })
          : undefined,
      },
    },
    assert: {
      assertions: {
        // Hard error. Accessibility regressions block merges — a11y is
        // a contract, not a preference. WCAG 2.1 AA bar.
        "categories:accessibility": ["error", { minScore: 0.95 }],
        // Warning. Performance scores are network-sensitive and vary
        // 5-10 points run-to-run on GitHub-hosted runners. Hard-gating
        // perf produces flaky CI without surfacing real regressions.
        "categories:performance": ["warn", { minScore: 0.85 }],
        // Warning. Best-practices catches HTTPS, console errors,
        // vulnerable libs — usually clean unless a real regression
        // appears.
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
