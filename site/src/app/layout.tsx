import type { Metadata } from "next";
import "./globals.css";
import Providers from "@/components/Providers";
import SiteHeader from "@/components/SiteHeader";
import MobileTabBar from "@/components/MobileTabBar";

export const metadata: Metadata = {
  title: "Utazás Napló",
  description: "Szép, gyors, kereshető utazási napló.",
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/icon-192.png",
  },
  manifest: "/site.webmanifest",
  themeColor: "#000000",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="hu">
      <head>
        <link rel="manifest" href="/site.webmanifest" />
        <meta name="theme-color" content="#000000" />
      </head>
      <body className="min-h-screen bg-white text-gray-900">
        <Providers>
          {/* Felső fix app bar */}
          <SiteHeader />
          {/* Tartalom: felül header helye (pt-16), alul tab bar helye (pb-16) */}
          <div className="pt-16 pb-16">{children}</div>
          {/* Alsó fix tab bar mobilon */}
          <MobileTabBar />
        </Providers>
      </body>
    </html>
  );
}
