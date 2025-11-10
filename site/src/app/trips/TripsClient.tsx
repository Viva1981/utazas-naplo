"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import TimelineFilters from "@/components/TimelineFilters";

type Trip = {
  id: string;
  title: string;
  destination?: string;
  start_date?: string;
  end_date?: string;
  visibility?: "public" | "private";
  owner_user_id?: string;
  created_by_name?: string;
};

export default function TripsClient() {
  const sp = useSearchParams();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [usersMap, setUsersMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  // Trips lekérés a query alapján
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
  }, [sp]);

  // Users map lekérés (id → display_name)
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch("/api/users-map", { cache: "force-cache" });
        const map = r.ok ? await r.json().catch(() => ({})) : {};
        if (alive) setUsersMap(map);
      } catch {
        if (alive) setUsersMap({});
      }
    })();
    return () => { alive = false; };
  }, []);

  // Kiegészített lista: ha nincs created_by_name, kipótlás owner_user_id alapján
  const enrichedTrips = useMemo(() => {
    if (!trips || !Array.isArray(trips)) return [];
    if (!usersMap || typeof usersMap !== "object") return trips;
    return trips.map(t => {
      if (t.created_by_name && t.created_by_name.trim() !== "") return t;
      const name = t.owner_user_id ? usersMap[t.owner_user_id] : undefined;
      return { ...t, created_by_name: name || t.created_by_name || "—" };
    });
  }, [trips, usersMap]);

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

      <div className="mb-4">
        <TimelineFilters />
      </div>

      {loading ? (
        <p>Betöltés…</p>
      ) : enrichedTrips.length === 0 ? (
        <p>
          Nincs találat. Próbálj másik keresést, vagy kezdj egy{" "}
          <a className="underline" href="/trips/new">új utazást</a>.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          {enrichedTrips.map((t) => (
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
