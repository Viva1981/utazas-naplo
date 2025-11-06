import type { Metadata } from "next";
import "./globals.css";
import Providers from "@/components/Providers";
import SiteHeader from "@/components/SiteHeader";

export const metadata: Metadata = {
  title: "Utazás Napló",
  description: "Szép, gyors, kereshető utazási napló.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="hu">
      <body className="min-h-screen bg-white text-gray-900">
        <Providers>
          <SiteHeader />
          <div className="pt-16">{children}</div>
        </Providers>
      </body>
    </html>
  );
}

