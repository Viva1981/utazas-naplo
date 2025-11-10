"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";

export default function MobileTabBar() {
  const pathname = usePathname();
  const { status } = useSession();

  async function trySignIn() {
    try {
      const mod = await import("next-auth/react");
      await mod.signIn(undefined, { callbackUrl: "/" });
    } catch {}
  }

  async function trySignOut() {
    try {
      const mod = await import("next-auth/react");
      await mod.signOut({ callbackUrl: "/" });
    } catch {}
  }

  const isTripsActive = pathname?.startsWith("/trips") || pathname === "/";

  return (
    <nav
      className="
        fixed bottom-0 left-0 right-0 z-[9999]
        border-t border-gray-200 bg-white/90 backdrop-blur-md
        md:hidden
      "
      aria-label="Alsó navigáció"
    >
      <ul className="grid grid-cols-2">
        {/* Utak */}
        <li>
          <Link
            href="/trips"
            className={`
              flex flex-col items-center justify-center py-2
              text-xs ${isTripsActive ? "font-semibold" : ""}
            `}
          >
            <span className="text-base leading-none">🧭</span>
            <span className="leading-none mt-1">Utak</span>
          </Link>
        </li>

        {/* Login / Logout */}
        <li>
          {status === "authenticated" ? (
            <a
              href="/api/auth/signout?callbackUrl=%2F"
              onClick={(e) => { e.preventDefault(); trySignOut(); }}
              className="flex flex-col items-center justify-center py-2 text-xs"
            >
              <span className="text-base leading-none">🚪</span>
              <span className="leading-none mt-1">Kijelentkezés</span>
            </a>
          ) : (
            <a
              href="/api/auth/signin?callbackUrl=%2F"
              onClick={(e) => { e.preventDefault(); trySignIn(); }}
              className="flex flex-col items-center justify-center py-2 text-xs"
            >
              <span className="text-base leading-none">🔑</span>
              <span className="leading-none mt-1">Bejelentkezés</span>
            </a>
          )}
        </li>
      </ul>
    </nav>
  );
}
