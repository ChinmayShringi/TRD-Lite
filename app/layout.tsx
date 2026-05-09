import type { Metadata, Viewport } from "next";
import { Inter, Source_Serif_4 } from "next/font/google";

import { Footer } from "@/src/components/Footer";
import { Header } from "@/src/components/Header";
import { getBaseUrl } from "@/src/lib/seo";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-heading",
  display: "swap",
  weight: ["400", "600", "700"],
});

// Resolve the deployment URL once, here, so every page that does not
// override `metadataBase` still gets absolute OG/Twitter/canonical
// URLs (Google, LinkedIn, and Slack all need fully-qualified URLs to
// render previews; relative paths produce broken cards).
const SITE_URL = getBaseUrl();
const SITE_NAME = "TRD Lite";
const SITE_DESCRIPTION =
  "TRD Lite is a fast, accessible mirror of The Real Deal real-estate news, built as a take-home demo. Latest commercial, residential, and development stories from New York, Chicago, Los Angeles, Miami, and beyond.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} - Real estate news`,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    "real estate news",
    "the real deal",
    "commercial real estate",
    "residential real estate",
    "real estate development",
    "NYC real estate",
    "Chicago real estate",
    "Los Angeles real estate",
    "Miami real estate",
  ],
  authors: [{ name: "TRD Lite" }],
  creator: "TRD Lite",
  publisher: "TRD Lite",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: SITE_NAME,
    title: `${SITE_NAME} - Real estate news`,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} - Real estate news`,
    description: SITE_DESCRIPTION,
  },
  // The site is a take-home demo, but every article points its
  // canonical back at the original therealdeal.com URL, so search
  // engines won't treat us as duplicate content. Allow indexing.
  robots: { index: true, follow: true },
  formatDetection: { email: false, telephone: false, address: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Match the OS chrome to the TRD Lite background in both modes so
  // mobile browsers do not paint a default white bar above the
  // masthead in dark mode.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

// Pre-hydration script that runs before React paints so the user
// never sees a flash of the wrong theme. Reads the saved preference
// (`localStorage.trd-lite-theme`); falls back to the system color
// scheme via `prefers-color-scheme`. Wrapped in try/catch because
// localStorage can throw in private browsing. The script body is a
// static literal under our control (no interpolation), which is why
// we inject it inline here. This is the standard Next.js pattern for
// avoiding the dark-mode flash on first load.
const THEME_INIT_SCRIPT = `(function(){try{var s=window.localStorage.getItem('trd-lite-theme');var p=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches;if(s==='dark'||(!s&&p))document.documentElement.classList.add('dark');}catch(_){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${sourceSerif.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }}
        />
      </head>
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-accent focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-white focus:shadow-lg focus:outline-none"
        >
          Skip to content
        </a>
        <Header />
        <main id="main" className="flex flex-1 flex-col">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
