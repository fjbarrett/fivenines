import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "shores · cloud provider status",
  description: "Aggregated up/down status for the major cloud providers.",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
