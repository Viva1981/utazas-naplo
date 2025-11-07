"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession, signIn, signOut } from "next-auth/react";
import { useState } from "react";

const tabs = [
  { href: "/", label: "Főoldal" },
  { href: "/timeline", label: "Idővonal" },
  { href: "/trips/new", label: "Új utazás" },
];

export default function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, status } = useSession();
  const [busy, setBusy] = useState<"in" | "out" | null>(null);

  async function doSignIn() {
    try {
      setBusy("in");
      // Elsődleges: normál NextAuth redirect
      await signIn("google", { callbackUrl: "/" });
    } catch {
      // Fallback: új tab, ha popup/redirect blokkolva lenne
      window.location.href = "/api/auth/signin?callbackUrl=%2F";
    } finally {
      setBusy(null);
    }
  }

  async function doSignOut() {
    try {
      setBusy("out");
      await signOut({ callbackUrl: "/" });
    } catch {
      window.location.href = "/api/auth/signout";
    } finally {
      setBusy(null);
      router.refresh();
    }
  }

  return (
    <header className="fixed inset-x-0 top-0 z-40 h-14 bg-white/90 backdrop-blur border-b">
      <div className="mx-auto max-w-5xl h-full px-3 flex items-center justify-between gap-3">
        <Link href="/" className="font-semibold">Utazás Napló</Link>

        <nav className="flex-1 flex justify-center gap-2 max-sm:hidden">
          {tabs.map((t) => {
            const active =
              pathname === t.href ||
              (t.href !== "/" && pathname?.startsWith(t.href));
            return (
              <Link
                key={t.href}
                href={t.href}
                className={`px-3 py-1.5 rounded-md text-sm ${
                  active ? "bg-black text-white" : "hover:bg-gray-100"
                }`}
              >
                {t.label}
              </Link>
            );
          })}
        </nav>

        {/* Auth blokk (jobb oldal) */}
        <div className="flex items-center gap-2">
          {status === "loading" ? (
            <span className="text-sm text-gray-600">Betöltés…</span>
          ) : session?.user ? (
            <>
              {/* Avatar + név (kattintásra főoldal) */}
              <button
                onClick={() => router.push("/")}
                className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-gray-100"
                title={session.user.email || ""}
              >
                {/* kis avatar */}
                {session.user.image ? (
                  <img
                    src={session.user.image}
                    alt="avatar"
                    className="w-7 h-7 rounded-full border"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full border grid place-items-center text-xs">
                    {(session.user.name || session.user.email || "U")
                      .slice(0, 1)
                      .toUpperCase()}
                  </div>
                )}
                <span className="hidden sm:inline text-sm max-w-[180px] truncate">
                  {session.user.name || session.user.email}
                </span>
              </button>

              <button
                onClick={doSignOut}
                disabled={busy === "out"}
                className="h-9 px-3 rounded-md border hover:bg-gray-50 text-sm"
                title="Kijelentkezés"
              >
                {busy === "out" ? "Kilépés…" : "Kilépés"}
              </button>
            </>
          ) : (
            <button
              onClick={doSignIn}
              disabled={busy === "in"}
              className="h-9 px-3 rounded-md border hover:bg-gray-50 text-sm"
              title="Bejelentkezés Google fiókkal"
            >
              {busy === "in" ? "Belépés…" : "Bejelentkezés"}
            </button>
          )}
        </div>
      </div>

      {/* Mobil menü: a tabok a középen lévő navban voltak — mobilon alul ott a MobileTabBar, ezért itt nem duplázzuk */}
    </header>
  );
}
