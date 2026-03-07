import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

export const metadata: Metadata = {
  title: "ChromaBrain — Knowledge Search",
  description:
    "Unified semantic search across all Chromapages knowledge files.",
  openGraph: {
    title: "ChromaBrain — Knowledge Search",
    description:
      "Unified semantic search across all Chromapages knowledge files.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="bg-zinc-50 text-zinc-900 font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
