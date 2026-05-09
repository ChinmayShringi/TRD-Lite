import type { Metadata, Viewport } from "next";
import { Inter, Source_Serif_4 } from "next/font/google";

import { Footer } from "@/src/components/Footer";
import { Header } from "@/src/components/Header";
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

export const metadata: Metadata = {
  title: {
    default: "TRD News (demo)",
    template: "%s | TRD News (demo)",
  },
  description:
    "A small news site mirror of The Real Deal, built as a take-home demo. Not affiliated.",
  // Per-page generateMetadata handlers populate openGraph/twitter so the
  // root never advertises a wrong default for article pages.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
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
