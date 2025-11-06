"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";

const items = [
  { href: "/",            label: "Főoldal",   icon: "🏠" },
  { href: "/trips",       label: "Utak",      icon: "🧭" },
  { href: "/timeline",    label: "Idővonal",  icon: "🗓️" },
  { href: "/protected",   label: "Profil",    icon: "🙂" }, // vagy /test-auth
];

export default function MobileTabBar() {
  const pathname = usePathname();
  const { status } = useSession();

  return (
    <nav
      className="
        fixed bottom-0 left-0 right-0 z-[9999]
        border-t border-gray-200 bg-white/90 backdrop-blur-md
        md:hidden
      "
      aria-label="Alsó navigáció"
    >
      <ul className="grid grid-cols-4">
        {items.map((it) => {
          // ha a profil védett, de nem vagy bejelentkezve → /api/auth/signin
          const href =
            it.href === "/protected" && status !== "authenticated"
              ? "/api/auth/signin?callbackUrl=%2Fprotected"
              : it.href;

          const active =
            it.href === "/"
              ? pathname === "/"
              : pathname?.startsWith(it.href);

          return (
            <li key={it.href}>
              <Link
                href={href}
                className={`
                  flex flex-col items-center justify-center py-2
                  text-xs ${active ? "font-semibold" : ""}
                `}
              >
                <span className="text-base leading-none">{it.icon}</span>
                <span className="leading-none mt-1">{it.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
