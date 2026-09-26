import type { Metadata } from "next";
import { Space_Grotesk, IBM_Plex_Mono } from "next/font/google";
import { AppShell } from "@/components/layout/AppShell";
import CustomCursor from "@/components/CustomCursor";
import NetworkBackground from "@/components/NetworkBackground";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Silent Ledger | Privacy-First Bitcoin Payment Layer",
  description:
    "Discover fresh Bitcoin payment addresses privately using Nostr, while keeping your transactions private.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${plexMono.variable}`}
    >
      <body className="min-h-full flex flex-col">
  <NetworkBackground />
  <CustomCursor />
  <div className="app-content">
    <AppShell>{children}</AppShell>
  </div>
</body>
    </html>
  );
}