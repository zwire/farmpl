import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { WarmupPing } from "./WarmupPing";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FarmPL",
  description: "Farm planning request composer and visualization dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {/* Non-blocking API warm-up */}
        {/* Reads NEXT_PUBLIC_FARMPL_API_BASE and pings /healthz once on mount */}
        <WarmupPing />
        {children}
      </body>
    </html>
  );
}
