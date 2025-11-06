"use client";

import { useEffect, useState } from "react";

type TimelineItem = {
  id: string;
  title: string;
  destination?: string;
  date?: string; // YYYY-MM vagy YYYY
  trip_id?: string;
};

export default function TimelinePage() {
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch("/api/timeline", { cache: "no-store" });
        const list: TimelineItem[] = r.ok ? await r.json().catch(() => []) : [];
        if (alive) setItems(list);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  return (
    <main className="max-w-4xl mx-auto px-4 py-4 md:py-8">
      <h1 className="text-xl md:text-2xl font-semibold mb-4">Idővonal</h1>

      {loading ? (
        <p>Betöltés…</p>
      ) : items.length === 0 ? (
        <p>Még nincs adat az idővonalon.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((it) => (
            <li key={it.id} className="border rounded-xl p-3 bg-white/80 backdrop-blur-sm">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-gray-500">{it.date || "—"}</div>
                  <div className="font-medium">{it.title}</div>
                  <div className="text-sm text-gray-700">{it.destination || "—"}</div>
                </div>
                {it.trip_id && (
                  <a
                    className="text-sm underline"
                    href={`/trips/${encodeURIComponent(it.trip_id)}`}
                  >
                    Megnyitás
                  </a>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
