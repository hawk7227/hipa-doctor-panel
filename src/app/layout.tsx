import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Medazon Health - Doctor Panel",
  description: "Medazon Health Telehealth Doctor Dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="antialiased bg-[#0B0F14] text-white" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
