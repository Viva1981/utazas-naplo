"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import TimelineFilters from "@/components/TimelineFilters";
import TripCard from "@/components/TripCard";

type Trip = {
  id: string;
  title: string;
  start_date?: string;
  end_date?: string;
  destination?: string;
  visibility?: "public" | "private";
};

export default function TimelineClient() {
  const sp = useSearchParams();
  const [items, setItems] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    for (const k of ["q", "from", "to", "vis", "mine"] as const) {
      const v = sp.get(k);
      if (v) p.set(k, v);
    }
    return p.toString();
  }, [sp]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    (async () => {
      const r = await fetch(`/api/trips/list${qs ? `?${qs}` : ""}`, { cache: "no-store" });
      const list: Trip[] = r.ok ? await r.json().catch(() => []) : [];
      if (!alive) return;
      setItems(Array.isArray(list) ? list : []);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [qs]);

  return (
    <>
      <TimelineFilters />
      {loading ? (
        <p>Betöltés…</p>
      ) : items.length === 0 ? (
        <p>Nincs találat a beállított szűrőkre.</p>
      ) : (
        <div className="grid gap-3">
          {items.map((t) => (
            <TripCard
              key={t.id}
              id={t.id}
              title={t.title}
              destination={t.destination}
              start_date={t.start_date}
              end_date={t.end_date}
              visibility={t.visibility}
            />
          ))}
        </div>
      )}
    </>
  );
}
