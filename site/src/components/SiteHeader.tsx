"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/", label: "Főoldal" },
  { href: "/timeline", label: "Idővonal" },
  { href: "/trips/new", label: "Új utazás" }, // ⬅️ itt a kért szöveg
];

export default function SiteHeader() {
  const pathname = usePathname();
  return (
    <header className="fixed inset-x-0 top-0 z-40 h-14 bg-white/90 backdrop-blur border-b">
      <div className="mx-auto max-w-5xl h-full px-3 flex items-center justify-between">
        <Link href="/" className="font-semibold">Utazás Napló</Link>
        <nav className="flex gap-2">
          {tabs.map(t => {
            const active = pathname === t.href || (t.href !== "/" && pathname?.startsWith(t.href));
            return (
              <Link
                key={t.href}
                href={t.href}
                className={`px-3 py-1.5 rounded-md text-sm ${active ? "bg-black text-white" : "hover:bg-gray-100"}`}
              >
                {t.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
