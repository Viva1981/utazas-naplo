"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Trip = {
  id: string;
  title: string;
  start_date?: string;
  end_date?: string;
  destination?: string;
  owner_user_id?: string;
  visibility?: "public" | "private";
};

function fmt(d?: string) {
  if (!d) return "";
  const [Y,M,D] = d.split("-");
  return `${Y}.${M}.${D}`;
}

export default function TimelinePage() {
  const [all, setAll] = useState<Trip[]>([]);
  const [q, setQ] = useState("");
  const [who, setWho] = useState<"all"|"public"|"mine">("all");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      const r = await fetch("/api/trips/list", { cache: "no-store" });
      const j = r.ok ? await r.json() : [];
      if (alive) setAll(j || []);
    })();
    return () => { alive = false; };
  }, []);

  const filtered = useMemo(() => {
    return (all || []).filter(t => {
      if (q) {
        const s = (t.title || "") + " " + (t.destination || "");
        if (!s.toLowerCase().includes(q.toLowerCase())) return false;
      }
      if (who === "public" && t.visibility !== "public") return false;
      if (who === "mine" && t.visibility !== "private") {
        // "mine" itt csak vizuális; a list api már szűrte a privát idegeneket ki,
        // de ha maradt public, azt engedjük – a fókusz a saját privátra amúgy is a trip oldalán derül ki
      }
      if (start && (t.start_date || "") < start) return false;
      if (end && (t.end_date || "") > end) return false;
      return true;
    });
  }, [all, q, who, start, end]);

  return (
    <main className="p-6 mx-auto max-w-5xl grid gap-4">
      <h1 className="text-2xl font-semibold">Idővonal</h1>

      {/* Szűrősáv */}
      <div className="grid gap-2 sm:grid-cols-5 bg-white border rounded-lg p-3">
        <input
          value={q}
          onChange={(e)=>setQ(e.target.value)}
          placeholder="Keresés cím/úti cél"
          className="border rounded px-2 py-1 sm:col-span-2"
        />
        <select value={who} onChange={(e)=>setWho(e.target.value as any)} className="border rounded px-2 py-1">
          <option value="all">Összes látható</option>
          <option value="public">Csak publikus</option>
          <option value="mine">Sajátok előre</option>
        </select>
        <input type="date" value={start} onChange={(e)=>setStart(e.target.value)} className="border rounded px-2 py-1" />
        <input type="date" value={end} onChange={(e)=>setEnd(e.target.value)} className="border rounded px-2 py-1" />
      </div>

      {/* Lista */}
      <ul className="grid gap-3">
        {filtered.map(t => (
          <li key={t.id} className="border rounded-lg p-3 bg-white hover:shadow transition">
            <div className="flex items-center justify-between gap-3">
              <div>
                <Link href={`/trips/${t.id}`} className="font-medium underline">{t.title}</Link>
                <div className="text-sm text-gray-600">
                  {t.destination} • {fmt(t.start_date)} → {fmt(t.end_date)}
                </div>
              </div>
              {t.visibility === "private" && (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-black/70 text-white">Privát</span>
              )}
            </div>
          </li>
        ))}
        {filtered.length === 0 && <em className="text-gray-600">Nincs találat a szűrőkre.</em>}
      </ul>
    </main>
  );
}
