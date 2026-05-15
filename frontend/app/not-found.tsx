import Link from "next/link";

/**
 * Custom 404 page — rendered by Next.js for any unmatched route inside
 * the app/ tree. Sits inside RootLayout, so it inherits the aurora
 * gradient background, the skip-link, and the SpeedInsights / Analytics
 * trackers. Same chat-shell-glass + prism-gradient design language as
 * the route-level error boundary so the brand voice stays consistent on
 * edge cases.
 *
 * Server Component (no "use client") — there's no interactivity beyond
 * a Link, which Next.js client-navigates without a directive.
 */
export default function NotFound() {
  return (
    <main className="relative isolate flex min-h-svh items-center justify-center px-4 py-8">
      <section
        aria-labelledby="not-found-heading"
        className="chat-shell-glass mx-auto flex w-full max-w-[520px] flex-col items-center gap-5 rounded-3xl p-10 text-center text-white"
      >
        <span className="prism-line" aria-hidden />
        <h1
          id="not-found-heading"
          className="m-0 bg-linear-to-r from-cyan-300 via-fuchsia-400 to-violet-400 bg-clip-text font-bold text-7xl text-transparent tracking-tight sm:text-8xl"
        >
          404
        </h1>
        <p className="m-0 max-w-[32ch] text-base text-white/85 leading-relaxed sm:text-lg">
          Lost in the universe of <strong>Coldplay</strong>.
        </p>
        <Link
          href="/"
          className="aurora-button rounded-full px-6 py-2 font-semibold text-base no-underline"
        >
          Take me home
        </Link>
      </section>
    </main>
  );
}
