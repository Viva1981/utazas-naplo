"use client";

import { useEffect, useState } from "react";

type Trip = {
  id: string;
  title: string;
  destination?: string;
  start_date?: string;
  end_date?: string;
  visibility?: "public" | "private";
};

export default function TripsPage() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch("/api/trips", { cache: "no-store" });
        const list: Trip[] = r.ok ? await r.json().catch(() => []) : [];
        if (alive) setTrips(list);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  return (
    <main className="max-w-5xl mx-auto px-4 py-4 md:py-8">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl md:text-2xl font-semibold">Utak</h1>
        <a
          href="/trips/new"
          className="border rounded-lg px-3 py-2 text-sm hover:bg-gray-50"
        >
          ➕ Új út
        </a>
      </div>

      {loading ? (
        <p>Betöltés…</p>
      ) : trips.length === 0 ? (
        <p>Még nincs felvett út. Kezdd az <a className="underline" href="/trips/new">új úttal</a>.</p>
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
            </a>
          ))}
        </div>
      )}
    </main>
  );
}
