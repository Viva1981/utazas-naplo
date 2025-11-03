"use client";

import { useEffect, useState } from "react";

type CostItem = {
  id: string;
  date: string;
  category: string;
  description: string;
  amount: number;
  currency: string;
};

export default function TripCosts({ tripId }: { tripId: string }) {
  const [items, setItems] = useState<CostItem[]>([]);
  const [totals, setTotals] = useState<Record<string, number>>({});
  const [form, setForm] = useState({
    date: "",
    category: "",
    description: "",
    amount: "",
    currency: "HUF",
  });

  async function refresh() {
    const r = await fetch(`/api/trips/${tripId}/costs`, { cache: "no-store" });
    const j = await r.json();
    setItems(j.items || []);
    setTotals(j.totals || {});
  }

  useEffect(() => { refresh(); }, [tripId]);

  async function addCost(e: React.FormEvent) {
    e.preventDefault();
    // TODO: POST bekötése a saját /api/trips/[id]/costs endpointodra
    // fetch(..., { method: "POST", body: JSON.stringify(form) })
    // Alap valid
    setForm({ date: "", category: "", description: "", amount: "", currency: "HUF" });
    await refresh();
  }

  return (
    <section style={{ display: "grid", gap: 12 }}>
      <h3 style={{ margin: 0 }}>Költségek</h3>

      <form onSubmit={addCost} style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))" }}>
        <input value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} type="date" placeholder="Dátum" />
        <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Kategória" />
        <input value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} type="number" step="0.01" placeholder="Összeg" />
        <input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} placeholder="Pénznem" />
        <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Megjegyzés" />
        <button type="submit">Hozzáad</button>
      </form>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", color: "#555" }}>
        {Object.keys(totals).length === 0 ? (
          <span>Még nincs összegzés.</span>
        ) : (
          Object.entries(totals).map(([cur, sum]) => (
            <span key={cur}><b>{cur}</b>: {sum.toLocaleString()}</span>
          ))
        )}
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        {items.map((c) => (
          <div key={c.id} style={{ border: "1px solid #eee", borderRadius: 8, padding: "8px 12px", display: "flex", justifyContent: "space-between", gap: 12 }}>
            <div style={{ display: "flex", gap: 10 }}>
              <span>{c.date}</span>
              <span>•</span>
              <span>{c.category}</span>
              {c.description ? <><span>•</span><span>{c.description}</span></> : null}
            </div>
            <div style={{ fontWeight: 600 }}>
              {c.amount.toLocaleString()} {c.currency}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
