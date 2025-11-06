"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";

export default function SiteHeader() {
  const { data: session, status } = useSession();

  // Nem hívunk preventDefault-ot. Ha a JS-es import/signIn mégis elhasal,
  // a <a href="..."> akkor is navigál az auth endpointra.
  async function trySignIn() {
    try {
      const mod = await import("next-auth/react");
      // ez redirectes navigációt indít; ha nem futna le,
      // a href úgyis elintézi
      await mod.signIn("google", { callbackUrl: "/" });
    } catch {
      // no-op
    }
  }

  async function trySignOut() {
    try {
      const mod = await import("next-auth/react");
      await mod.signOut({ callbackUrl: "/" });
    } catch {
      // no-op
    }
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-[9999] bg-white/80 backdrop-blur-md border-b border-gray-200">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/" className="font-semibold tracking-tight text-gray-800">
          Utazás Napló
        </Link>

        <nav className="flex items-center gap-4 text-sm">
          <Link href="/" className="hover:underline">Főoldal</Link>
          <Link href="/trips" className="hover:underline">Utak</Link>
          <Link href="/timeline" className="hover:underline">Idővonal</Link>

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
