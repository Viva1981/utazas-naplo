"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AuthButtons from "@/components/AuthButtons";

type TimelineItem = {
  id: string;
  title: string;
  destination?: string;
  start_date?: string;
  end_date?: string;
  visibility?: "public" | "private";
  cover_thumb?: string;
  is_owner?: boolean;
};

function niceDate(d?: string) {
  if (!d) return "";
  const [Y, M, D] = d.split("-");
  return `${Y}.${M}.${D}`;
}

export default function Home() {
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const r = await fetch("/api/timeline", { cache: "no-store" });
      const j = await r.json().catch(() => ({ items: [] }));
      setItems(Array.isArray(j.items) ? j.items : []);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((it) => {
      const hay = `${it.title || ""} ${it.destination || ""}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [items, q]);

  const latest = filtered.slice(0, 6);

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex min-h-screen w-full max-w-5xl flex-col items-center justify-start px-6 py-12 sm:px-10 sm:py-16 bg-white dark:bg-black">
        {/* HERO */}
        <section className="w-full rounded-2xl border border-zinc-200/70 dark:border-white/10 bg-gradient-to-b from-white to-zinc-50 dark:from-black dark:to-zinc-900 p-6 sm:p-8">
          <div className="flex flex-col gap-6 text-center sm:text-left">
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-black dark:text-zinc-50">
              Utazás Napló 🌍
            </h1>
            <p className="text-lg leading-7 text-zinc-600 dark:text-zinc-400">
              Minden utazásod egy helyen: idővonal, képek, fájlok, költségek.
              Jelentkezz be a Google-fiókoddal és kezdjük az élmények gyűjtését.
            </p>

            <div className="flex justify-center sm:justify-start">
              <AuthButtons />
            </div>

            {/* Gyors műveletek (feltöltés gomb nélkül) */}
            <div className="mt-2 flex flex-col sm:flex-row gap-3">
              <Link
                href="/trips/new"
                className="inline-flex h-11 items-center justify-center rounded-full bg-black px-5 text-white transition-colors hover:bg-zinc-700 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
              >
                + Új utazás
              </Link>
              <Link
                href="/timeline"
                className="inline-flex h-11 items-center justify-center rounded-full border border-zinc-300 px-5 text-black hover:bg-black/5 dark:text-white dark:border-white/20 dark:hover:bg-white/10"
              >
                Összes utazás
              </Link>
            </div>

            {/* Kereső */}
            <div className="mt-4 flex items-center gap-3">
              <input
                placeholder="Keresés cím vagy célpont szerint…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="w-full max-w-xl rounded-xl border border-zinc-300 dark:border-white/20 bg-white dark:bg-zinc-900 px-4 py-3 outline-none placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
              />
              <span className="text-xs text-zinc-500">
                {loading ? "Betöltés…" : `${filtered.length} találat`}
              </span>
            </div>
          </div>
        </section>

        {/* LEGUTÓBBI UTAK */}
        <section className="mt-10 w-full">
          <div className="mb-4 flex items-baseline justify-between gap-3">
            <h2 className="text-xl font-semibold text-black dark:text-zinc-50">
              Legutóbbi utak
            </h2>
            <Link
              href="/timeline"
              className="text-sm text-zinc-800 hover:underline dark:text-zinc-200"
            >
              Összes megnyitása →
            </Link>
          </div>

          {loading ? (
            <div className="grid gap-4 sm:gap-6 grid-cols-[repeat(auto-fill,minmax(240px,1fr))]">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-zinc-200 dark:border-white/10 overflow-hidden animate-pulse"
                >
                  <div className="aspect-[16/9] bg-zinc-200/70 dark:bg-zinc-800" />
                  <div className="p-3">
                    <div className="h-4 w-2/3 bg-zinc-200/70 dark:bg-zinc-700 rounded mb-2" />
                    <div className="h-3 w-1/2 bg-zinc-200/70 dark:bg-zinc-700 rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : latest.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-300 dark:border-white/20 p-6 text-zinc-600 dark:text-zinc-400">
              Még nincs megjeleníthető út. Hozz létre egyet az „Új utazás” gombbal!
            </div>
          ) : (
            <div className="grid gap-4 sm:gap-6 grid-cols-[repeat(auto-fill,minmax(240px,1fr))]">
              {latest.map((it) => (
                <Link
                  key={it.id}
                  href={`/trips/${it.id}`}
                  className="group rounded-xl border border-zinc-200 dark:border-white/10 overflow-hidden hover:shadow-sm transition"
                >
                  <div className="aspect-[16/9] bg-zinc-100 dark:bg-zinc-900 grid place-items-center overflow-hidden">
                    {it.cover_thumb ? (
                      <img
                        src={it.cover_thumb}
                        alt={it.title}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="text-4xl">🧳</div>
                    )}
                  </div>
                  <div className="p-3 flex flex-col gap-1.5">
                    <div className="font-semibold leading-tight group-hover:underline">
                      {it.title}
                    </div>
                    <div className="text-sm text-zinc-600 dark:text-zinc-400">
                      {it.destination || "—"} • {niceDate(it.start_date)} → {niceDate(it.end_date)}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-zinc-500">
                      {it.visibility === "private" && <span>Privát</span>}
                      {it.is_owner && <span>Saját</span>}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
