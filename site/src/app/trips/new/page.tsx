"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function NewTripPage() {
  const r = useRouter();
  const [msg, setMsg] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg("Mentés…");
    const fd = new FormData(e.currentTarget);
    const payload = {
      title: String(fd.get("title") || ""),
      start_date: String(fd.get("start_date") || ""),
      end_date: String(fd.get("end_date") || ""),
      destination: String(fd.get("destination") || ""),
      visibility: String(fd.get("visibility") || "public"),
    };
    const res = await fetch("/api/trips/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      credentials: "include",
    });
    let j: any = null; try { j = await res.json(); } catch {}
    if (res.ok && j?.ok && j?.trip?.id) {
      // azonnal átdobunk a trip oldalra:
      r.push(`/trips/${j.trip.id}`);
      r.refresh();
      return;
    }
    setMsg("Hiba ❌ " + (j?.error || res.status));
  }

  return (
    <main className="p-6 max-w-xl mx-auto grid gap-4">
      <h1 className="text-2xl font-semibold">Új utazás</h1>
      <form onSubmit={onSubmit} className="grid gap-3">
        <label className="grid gap-1">
          <span className="text-xs text-gray-600">Cím</span>
          <input name="title" required className="border rounded px-2 py-1" placeholder="Pl. Téli Tátra" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="grid gap-1">
            <span className="text-xs text-gray-600">Kezdet</span>
            <input type="date" name="start_date" className="border rounded px-2 py-1" />
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-gray-600">Vége</span>
            <input type="date" name="end_date" className="border rounded px-2 py-1" />
          </label>
        </div>
        <label className="grid gap-1">
          <span className="text-xs text-gray-600">Úti cél</span>
          <input name="destination" className="border rounded px-2 py-1" placeholder="Pl. Murzasichle, Lengyelország" />
        </label>
        <label className="grid gap-1">
          <span className="text-xs text-gray-600">Láthatóság</span>
          <select name="visibility" defaultValue="public" className="border rounded px-2 py-1">
            <option value="public">Publikus</option>
            <option value="private">Privát</option>
          </select>
        </label>
        <div className="flex items-center gap-3">
          <button className="border rounded px-4 py-2">Mentés</button>
          <span className="text-sm text-gray-600">{msg}</span>
        </div>
      </form>
    </main>
  );
}
