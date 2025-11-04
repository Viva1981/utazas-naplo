"use client";

import { useSession, signIn, signOut } from "next-auth/react";

export default function SiteHeader() {
  const { data: session, status } = useSession();

  return (
    <header className="fixed top-0 left-0 right-0 z-[9999] pointer-events-auto bg-white/80 backdrop-blur-md border-b border-gray-200">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <a href="/" className="font-semibold tracking-tight text-gray-800">
          Utazás Napló
        </a>

        <nav className="flex items-center gap-3">
          {status === "authenticated" && session?.user ? (
            <>
              <span className="text-sm text-gray-700 truncate max-w-[180px]">
                👋 {session.user.name || session.user.email}
              </span>
              <button
  onClick={(e) => {
    e.preventDefault();
    // 1) próbáld programozottan (Google provider)
    Promise.resolve(
      // ha más providert használsz, ide írd az ID-t
      signIn("google", { callbackUrl: "/" })
    ).catch(() => {
      // 2) biztos fallback: teljes navigáció az auth oldalra
      window.location.href = "/api/auth/signin?callbackUrl=/";
    });
  }}
  className="text-sm px-3 py-1 rounded-md bg-blue-600 text-white hover:bg-blue-700"
  title="Bejelentkezés"
>
  Bejelentkezés
</button>

          )}
        </nav>
      </div>
    </header>
  );
}
