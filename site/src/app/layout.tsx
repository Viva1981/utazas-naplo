import "./globals.css";
import type { Metadata } from "next";
import Providers from "@/components/Providers"; // ha kell: "../components/Providers"

export const metadata: Metadata = {
  title: "Utazás Napló",
  description: "Személyes utazási napló",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="hu">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

