import type { Metadata } from "next";
import Link from "next/link";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "9s",
  description: "Aggregated up/down status for the major cloud providers.",
  icons: { icon: "/favicon.svg" },
};

// Google Analytics (GA4) — only loads when NEXT_PUBLIC_GA_ID (G-XXXXXXXXXX) is set.
const gaId = process.env.NEXT_PUBLIC_GA_ID;

// Computed at module load (not during render) so the purity lint rule is happy.
const year = new Date().getFullYear();

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        {children}
        <footer className="border-t border-white/[0.06] px-6 py-6 text-center font-mono text-xs text-slate-600 lg:px-12">
          <Link href="/about" className="text-slate-500 transition hover:text-slate-300">
            about
          </Link>
          <span className="mx-2 text-slate-700">·</span>© {year} Availability
        </footer>
        {gaId && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
              strategy="afterInteractive"
            />
            <Script id="ga4-init" strategy="afterInteractive">
              {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${gaId}');`}
            </Script>
          </>
        )}
      </body>
    </html>
  );
}
