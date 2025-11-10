"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import TimelineFilters from "@/components/TimelineFilters";

type Trip = {
  id: string;
  title: string;
  destination?: string;
  start_date?: string;
  end_date?: string;
  visibility?: "public" | "private";
  owner_user_id?: string;     // DB-ből jöhet
  created_by_name?: string;   // API join: Users.display_name (fallback: "—")
};

export default function TripsPage() {
  const sp = useSearchParams();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const qs = sp.toString();
        const r = await fetch(`/api/trips${qs ? `?${qs}` : ""}`, { cache: "no-store" });
        const list: Trip[] = r.ok ? await r.json().catch(() => []) : [];
        if (alive) setTrips(list);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [sp]); // újra-fetchel a URL query alapján
  //                    ^ a TimelineFilters módosítja az URL-t -> frissül a lista

  return (
    <main className="max-w-5xl mx-auto px-4 py-4 md:py-8">
      <div className="flex items-center justify-between mb-3 md:mb-4">
        <h1 className="text-xl md:text-2xl font-semibold">Utak</h1>
        <a
          href="/trips/new"
          className="border rounded-lg px-3 py-2 text-sm hover:bg-gray-50"
        >
          ➕ Új utazás
        </a>
      </div>

      {/* Keresősáv a tetején (ugyanaz a logika, mint timeline-on) */}
      <div className="mb-4">
        <TimelineFilters />
      </div>

      {loading ? (
        <p>Betöltés…</p>
      ) : trips.length === 0 ? (
        <p>
          Nincs találat. Próbálj másik keresést, vagy kezdj egy{" "}
          <a className="underline" href="/trips/new">új utazást</a>.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          {trips.map((t) => (
            <a
              key={t.id}
              href={`/trips/${encodeURIComponent(t.id)}`}
              className="
                group border rounded-2xl p-4 bg-white/80 backdrop-blur-sm
                hover:bg-white shadow-sm hover:shadow-md transition
              "
            >
              <div className="flex items-start justify-between">
                <h2 className="font-semibold">{t.title}</h2>
                <span className="text-xs text-gray-600">
                  {t.visibility === "private" ? "🔒" : "🌍"}
                </span>
              </div>

              <p className="text-sm text-gray-700 mt-1">
                {t.destination || "—"}
              </p>

              <p className="text-xs text-gray-500 mt-1">
                {(t.start_date || "—")} → {(t.end_date || "—")}
              </p>

              {/* Létrehozó neve */}
              <p className="text-xs text-gray-500 mt-1">
                Létrehozta: {t.created_by_name || "—"}
              </p>
            </a>
          ))}
        </div>
      )}
    </main>
  );
}
