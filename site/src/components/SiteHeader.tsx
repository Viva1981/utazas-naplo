"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";

export default function SiteHeader() {
  const { data: session, status } = useSession();

  function handleSignIn(e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault();

    // 1) programozott login
    void import("next-auth/react")
      .then(({ signIn }) => signIn("google", { callbackUrl: "/" }))
      .catch(() => {
        // 2) biztos fallback: teljes navigáció
        window.location.href = "/api/auth/signin?callbackUrl=/";
      });

    // 3) extra biztonsági fallback 800ms után
    setTimeout(() => {
      if (!location.pathname.startsWith("/api/auth")) {
        window.location.href = "/api/auth/signin?callbackUrl=/";
      }
    }, 800);
  }

  function handleSignOut(e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault();

    // 1) programozott logout
    void import("next-auth/react")
      .then(({ signOut }) => signOut({ callbackUrl: "/" }))
      .catch(() => {
        // 2) biztos fallback: teljes navigáció
        window.location.href = "/api/auth/signout";
      });

    // 3) extra fallback
    setTimeout(() => {
      if (!location.pathname.startsWith("/api/auth")) {
        window.location.href = "/api/auth/signout";
      }
    }, 800);
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
            <button
              className="ml-3 border rounded px-3 py-1"
              onClick={handleSignOut}
              title={session.user.email || "Kijelentkezés"}
            >
              Kijelentkezés
            </button>
          ) : (
            <button
              className="ml-3 border rounded px-3 py-1"
              onClick={handleSignIn}
            >
              Bejelentkezés
            </button>
          )}
        </nav>
      </div>
    </header>
  );
}
