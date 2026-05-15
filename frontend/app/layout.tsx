import { SpeedInsights } from "@vercel/speed-insights/next";
import type { Metadata, Viewport } from "next";

import "./globals.css";

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
    <html lang="en">
      <body>
        {/* Skip-link: keyboard users tab to it first; visually hidden
            until focused. Targets the `id="main-content"` landmark on
            HomePage so the chat is reachable in one keystroke. */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:rounded-full focus:bg-white focus:px-4 focus:py-2 focus:font-semibold focus:text-slate-900 focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-cyan-400"
        >
          Skip to main content
        </a>
        {children}
        {/* Vercel Speed Insights — Core Web Vitals (LCP, FID, CLS, INP,
            TTFB, FCP) reported to the Vercel project's Speed Insights
            tab. No-op when not running on Vercel; zero-config on Vercel
            Pro. Lives as a sibling of children so it doesn't intercept
            any layout or styling. */}
        <SpeedInsights />
      </body>
    </html>
  );
}
