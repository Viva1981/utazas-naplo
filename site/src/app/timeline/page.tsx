"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type TimelineItem = {
  id: string;
  title: string;
  destination?: string;
  start_date?: string;
  end_date?: string;
  visibility?: "public" | "private";
  cover_thumb?: string; // API tölti ki
  is_owner?: boolean;   // API tölti ki
};

type Grouped = Record<string, TimelineItem[]>; // "YYYY-MM" -> items

function ymKey(d?: string) {
  if (!d) return "0000-00";
  // d = YYYY-MM-DD
  const [Y, M] = d.split("-");
  return `${Y}-${M}`;
}

function ymLabel(ym: string) {
  // ym = YYYY-MM
  const [Y, M] = ym.split("-");
  const date = new Date(Number(Y), Number(M) - 1, 1);
  const monthHu = new Intl.DateTimeFormat("hu-HU", { month: "long" }).format(date);
  return `${Y} • ${monthHu}`;
}

function niceDate(d?: string) {
  if (!d) return "";
  const [Y, M, D] = d.split("-");
  return `${Y}.${M}.${D}`;
}

function SkeletonCard() {
  return (
    <div
      style={{
        border: "1px solid #eee",
        borderRadius: 10,
        overflow: "hidden",
        background: "#fff",
        display: "grid",
        animation: "pulse 1.2s ease-in-out infinite",
      }}
    >
      <div style={{ width: "100%", aspectRatio: "16 / 9", background: "#f1f1f1" }} />
      <div style={{ padding: 12, display: "grid", gap: 8 }}>
        <div style={{ height: 16, background: "#f1f1f1", borderRadius: 4 }} />
        <div style={{ height: 12, background: "#f4f4f4", borderRadius: 4, width: "70%" }} />
      </div>
      <style>{`@keyframes pulse { 0%{opacity:.7} 50%{opacity:1} 100%{opacity:.7} }`}</style>
    </div>
  );
}

export default function TimelinePage() {
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Szűrő állapotok
  const [year, setYear] = useState<string>("all");
  const [month, setMonth] = useState<string>("all");
  const [onlyMine, setOnlyMine] = useState(false);
  const [onlyPublic, setOnlyPublic] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const r = await fetch("/api/timeline", { cache: "no-store" });
      const j = await r.json().catch(() => ({ items: [] }));
      setItems(j.items || []);
      setLoading(false);
      try { window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior }); } catch {}
    })();
  }, []);

  // Elérhető évek az adatokból
  const yearOptions = useMemo(() => {
    const set = new Set<string>();
    items.forEach((it) => {
      if (it.start_date) set.add(it.start_date.split("-")[0]);
    });
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [items]);

  const monthOptions = [
    { v: "01", n: "január" },
    { v: "02", n: "február" },
    { v: "03", n: "március" },
    { v: "04", n: "április" },
    { v: "05", n: "május" },
    { v: "06", n: "június" },
    { v: "07", n: "július" },
    { v: "08", n: "augusztus" },
    { v: "09", n: "szeptember" },
    { v: "10", n: "október" },
    { v: "11", n: "november" },
    { v: "12", n: "december" },
  ];

  // Szűrés
  const filtered = useMemo(() => {
    return items.filter((it) => {
      if (onlyMine && !it.is_owner) return false;
      if (onlyPublic && it.visibility !== "public") return false;
      if (year !== "all" && it.start_date?.slice(0, 4) !== year) return false;
      if (month !== "all" && it.start_date?.slice(5, 7) !== month) return false;
      return true;
    });
  }, [items, year, month, onlyMine, onlyPublic]);

  // Év–hónap csoportosítás
  const grouped: Grouped = useMemo(() => {
    return filtered.reduce((acc, it) => {
      const key = ymKey(it.start_date);
      (acc[key] ||= []).push(it);
      return acc;
    }, {} as Grouped);
  }, [filtered]);

  const keys = Object.keys(grouped).sort((a, b) => b.localeCompare(a)); // YYYY-MM lexikografikus

  return (
    <main style={{ padding: 24, display: "grid", gap: 24 }}>
      <header style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
          <h1 style={{ margin: 0 }}>Idővonal</h1>
          <span style={{ color: "#666" }}>Összes utazás – publikus + saját privát</span>
        </div>

        {/* Szűrők */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span>Év</span>
            <select value={year} onChange={(e) => setYear(e.target.value)}>
              <option value="all">összes</option>
              {yearOptions.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </label>

          <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span>Hónap</span>
            <select value={month} onChange={(e) => setMonth(e.target.value)}>
              <option value="all">összes</option>
              {monthOptions.map((m) => (
                <option key={m.v} value={m.v}>{m.n}</option>
              ))}
            </select>
          </label>

          <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input type="checkbox" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} />
            <span>csak saját</span>
          </label>

          <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input type="checkbox" checked={onlyPublic} onChange={(e) => setOnlyPublic(e.target.checked)} />
            <span>csak publikus</span>
          </label>
        </div>
      </header>

      {loading && (
        <div
          style={{
            display: "grid",
            gap: 16,
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
          }}
        >
          {Array.from({ length: 8 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}

      {!loading && keys.length === 0 && <p>Még nincs megjeleníthető út.</p>}

      {!loading &&
        keys.map((k) => (
          <section key={k} style={{ display: "grid", gap: 12 }}>
            <h2 style={{ margin: 0, fontSize: 18 }}>{ymLabel(k)}</h2>

            <div
              style={{
                display: "grid",
                gap: 16,
                gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
              }}
            >
              {grouped[k].map((it) => (
                <Link
                  key={it.id}
                  href={`/trips/${it.id}`}
                  style={{
                    border: "1px solid #eee",
                    borderRadius: 10,
                    overflow: "hidden",
                    background: "#fff",
                    textDecoration: "none",
                    color: "inherit",
                    display: "grid",
                  }}
                >
                  <div
                    style={{
                      width: "100%",
                      aspectRatio: "16 / 9",
                      background: "#f7f7f7",
                      display: "grid",
                      placeItems: "center",
                      overflow: "hidden",
                    }}
                  >
                    {it.cover_thumb ? (
                      <img
                        src={it.cover_thumb}
                        alt={it.title}
                        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                        loading="lazy"
                      />
                    ) : (
                      <div style={{ fontSize: 40 }}>🧳</div>
                    )}
                  </div>

                  <div style={{ padding: 12, display: "grid", gap: 6 }}>
                    <div style={{ fontWeight: 700, fontSize: 16, lineHeight: 1.2 }}>{it.title}</div>
                    <div style={{ color: "#555", fontSize: 13 }}>
                      {it.destination || "—"} • {niceDate(it.start_date)} → {niceDate(it.end_date)}
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      {it.visibility === "private" && (
                        <span style={{ fontSize: 11, color: "#999" }}>Privát</span>
                      )}
                      {it.is_owner && (
                        <span style={{ fontSize: 11, color: "#999" }}>Saját</span>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ))}
    </main>
  );
}
