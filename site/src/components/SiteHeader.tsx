"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";

export default function SiteHeader() {
  const { data: session, status } = useSession();

  // Csak “rásegítünk” JS-ből; ha nem sikerül, a href így is működik.
  async function trySignIn() {
    try {
      const mod = await import("next-auth/react");
      await mod.signIn("google", { callbackUrl: "/" });
    } catch {}
  }

  async function trySignOut() {
    try {
      const mod = await import("next-auth/react");
      await mod.signOut({ callbackUrl: "/" });
    } catch {}
  }

  return (
    <header className="hidden md:block fixed top-0 left-0 right-0 z-[9999] bg-white/80 backdrop-blur-md border-b border-gray-200">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        {/* Brand → /trips */}
        <Link href="/trips" className="font-semibold tracking-tight text-gray-800">
          Utazás Napló
        </Link>

        {/* Csak az auth gombok maradnak */}
        <nav className="flex items-center gap-4 text-sm">
          {status === "authenticated" && session?.user ? (
            <a
              href="/api/auth/signout?callbackUrl=%2F"
              onClick={trySignOut}
              className="ml-3 border rounded px-3 py-1"
              title={session.user.email || "Kijelentkezés"}
            >
              Kijelentkezés
            </a>
          ) : (
            <a
              href="/api/auth/signin/google?callbackUrl=%2F"
              onClick={trySignIn}
              className="ml-3 border rounded px-3 py-1"
            >
              Bejelentkezés
            </a>
          )}
        </nav>
      </div>
    </header>
  );
}
