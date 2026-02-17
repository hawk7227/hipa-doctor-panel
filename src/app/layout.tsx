// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
import type { Metadata } from "next";
import "./globals.css";
import SyncInitializer from "@/components/SyncInitializer";
import SyncStatusBar from "@/components/SyncStatusBar";
import OfflineBanner from "@/components/OfflineBanner";

export const metadata: Metadata = {
  title: "Medazon Health - Doctor Panel",
  description: "Telehealth platform for healthcare providers",
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#00CBA9" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body
        className={`antialiased bg-gray-900 text-white`}
        suppressHydrationWarning
      >
        <SyncInitializer />
        <OfflineBanner />
        {children}
        <SyncStatusBar />
      </body>
    </html>
  );
}
