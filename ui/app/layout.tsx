import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { TemplatesBootstrap } from "./TemplatesBootstrap";

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
        {/* Preload master templates (crops) once on mount */}
        <TemplatesBootstrap />
        {children}
      </body>
    </html>
  );
}
