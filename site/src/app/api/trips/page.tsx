"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

type Trip = { id: string; title: string; start_date?: string; end_date?: string; destination?: string };

export default function TripsPage() {
  const [items, setItems] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const r = await fetch("/api/trips/list");
      const j = await r.json();
      setItems(j.items || []);
      setLoading(false);
    })();
  }, []);

  return (
    <main style={{ padding: 24 }}>
      <h1>Utak</h1>
      <div style={{ margin: "12px 0" }}>
        <Link href="/trips/new">+ Új út</Link>
      </div>
      {loading ? <p>Betöltés…</p> : (
        <ul style={{ display: "grid", gap: 12 }}>
          {items.map(t => (
            <li key={t.id} style={{ border: "1px solid #eee", borderRadius: 8, padding: 12 }}>
              <div style={{ fontWeight: 600 }}>{t.title}</div>
              <div style={{ fontSize: 12, color: "#666" }}>
                {t.destination} • {t.start_date} → {t.end_date}
              </div>
              <div><Link href={`/trips/${t.id}`}>Részletek</Link></div>
            </li>
          ))}
          {items.length === 0 && <p>Még nincs felvett út.</p>}
        </ul>
      )}
    </main>
  );
}
