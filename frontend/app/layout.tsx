import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { TooltipProvider } from "@/components/ui/tooltip";

import "./globals.css";

// Vercel's Geist Sans + Mono — self-hosted via next/font/google (build-time
// download + subset, zero runtime CDN dep). `display: "swap"` shows the
// system fallback immediately and swaps to Geist when ready — no FOIT, no
// CLS from font-metric mismatch. The `variable` option injects the CSS
// custom property onto <html>; Tailwind v4's @theme inline block in
// globals.css maps it to --font-sans / --font-mono so every `font-sans` /
// `font-mono` utility resolves to Geist.
const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

const SITE_NAME = "Coldplay AI Companion";
const SITE_DESCRIPTION =
  "An AI companion for the universe of Coldplay — songs, albums, eras, members, live shows, and everything in between. A non-commercial educational student project.";

export const metadata: Metadata = {
  // Vercel auto-sets VERCEL_URL to the deployment's own hostname for
  // every prod + preview build. Fall back to localhost in dev. Critical
  // for social shares: OG image URLs resolve relative to this base, so a
  // wrong value produces broken Twitter / Slack / LinkedIn cards.
  metadataBase: new URL(
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000"
  ),
  title: {
    default: SITE_NAME,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  authors: [{ name: "AI Engineer Challenge" }],
  keywords: ["Coldplay", "AI chat", "music", "OpenAI", "Next.js", "Tailwind", "educational"],
  category: "education",
  // Intentional. This is a non-commercial educational project that uses
  // Coldplay brand IP under fair use. Allowing search-engine indexing
  // would risk brand-confusion / IP concerns. Lighthouse drops SEO to
  // ~63 because of this — that is by design, not a regression.
  robots: {
    index: false,
    follow: false,
  },
  icons: {
    icon: "https://eustore.coldplay.com/cdn/shop/files/heart_favicon.png?v=1770660766",
    shortcut: "https://eustore.coldplay.com/cdn/shop/files/heart_favicon.png?v=1770660766",
    apple: "https://eustore.coldplay.com/cdn/shop/files/heart_favicon.png?v=1770660766",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
  },
};

export const viewport: Viewport = {
  themeColor: "#0f3260",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      {/* Browser extensions (ColorZilla `cz-shortcut-listen`, 1Password,
          Grammarly, dark-reader, etc.) inject `<body>` attributes between
          SSR and hydration. suppressHydrationWarning silences ONLY the
          attribute mismatch on this element — real React-tree drift in
          the subtree still warns. */}
      <body suppressHydrationWarning>
        {/* Skip-link: keyboard users tab to it first; visually hidden
            until focused. Targets the `id="main-content"` landmark on
            HomePage so the chat is reachable in one keystroke. */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:rounded-full focus:bg-white focus:px-4 focus:py-2 focus:font-semibold focus:text-slate-900 focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-cyan-400"
        >
          Skip to main content
        </a>
        {/* Root-level tooltip provider. delayDuration kept conservative so
            tooltips don't pop on incidental hovers but appear quickly when
            a user hovers with intent. Single provider for the whole tree
            so descendant <Tooltip /> usages don't need their own. */}
        <TooltipProvider delayDuration={250} skipDelayDuration={400}>
          {children}
        </TooltipProvider>
        {/* Vercel Speed Insights — Core Web Vitals (LCP, FID, CLS, INP,
            TTFB, FCP) reported to the Vercel project's Speed Insights
            tab. No-op when not running on Vercel; zero-config on Vercel
            Pro. Lives as a sibling of children so it doesn't intercept
            any layout or styling. */}
        <SpeedInsights />
        {/* Vercel Web Analytics — anonymous page-view tracking reported
            to the project's Analytics tab. Same no-op-off-Vercel + no-
            DOM behavior as SpeedInsights. Companion data: SpeedInsights
            covers perf, Analytics covers reach. */}
        <Analytics />
      </body>
    </html>
  );
}
