"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

type Trip = { id: string; title: string; start_date?: string; end_date?: string; destination?: string };

export default function TripsPage() {
  const [items, setItems] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErrorMsg(null);
      try {
        const r = await fetch("/api/trips/list");
        if (!r.ok) {
          const txt = await r.text(); // ne json()-t, mert lehet üres
          setErrorMsg(`Hiba: ${r.status} ${txt || r.statusText}`);
          setItems([]);
        } else {
          const j = await r.json().catch(() => ({ items: [] })); // védőháló
          setItems(j.items || []);
        }
      } catch (e: any) {
        setErrorMsg(`Hálózati hiba: ${String(e)}`);
        setItems([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <main style={{ padding: 24 }}>
      <h1>Utak</h1>
      <div style={{ margin: "12px 0" }}>
        <Link href="/trips/new">+ Új út</Link>
      </div>

      {loading && <p>Betöltés…</p>}
      {errorMsg && <p style={{ color: "crimson" }}>{errorMsg}</p>}

      {!loading && !errorMsg && (
        <ul style={{ display: "grid", gap: 12 }}>
          {items.map((t) => (
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
