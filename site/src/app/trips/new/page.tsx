"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function NewTrip() {
  const router = useRouter();
  const [msg, setMsg] = useState<string>("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg("Mentés…");
    const form = e.currentTarget;
    const fd = new FormData(form);

    const payload = {
      title: String(fd.get("title") || ""),
      destination: String(fd.get("destination") || ""),
      start_date: String(fd.get("start_date") || ""),
      end_date: String(fd.get("end_date") || ""),
      visibility: String(fd.get("visibility") || "public"),
    };

    const r = await fetch("/api/trips/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      credentials: "include",
    });

    let j: any = null;
    try { j = await r.json(); } catch { j = null; }

    if (r.ok && j?.ok && j?.trip?.id) {
      // közvetlenül a frissen létrehozott utazásra lépünk
      router.push(`/trips/${j.trip.id}`);
      router.refresh();
      return;
    }

    setMsg("Hiba ❌ " + (j?.error || r.status));
  }

  return (
    <main className="p-6 max-w-xl mx-auto grid gap-4">
      <h1 className="text-2xl font-semibold">Új utazás</h1>

      <form onSubmit={onSubmit} className="grid gap-3">
        <input name="title" placeholder="Cím (pl. Róma hétvége)" required className="border rounded px-2 py-1" />
        <input name="destination" placeholder="Cél (pl. Róma, Olaszország)" required className="border rounded px-2 py-1" />
        <div className="grid grid-cols-2 gap-3">
          <input type="date" name="start_date" required className="border rounded px-2 py-1" />
          <input type="date" name="end_date" required className="border rounded px-2 py-1" />
        </div>
        <label className="grid gap-1">
          <span className="text-xs text-gray-600">Láthatóság</span>
          <select name="visibility" defaultValue="public" className="border rounded px-2 py-1">
            <option value="public">Publikus</option>
            <option value="private">Privát</option>
          </select>
        </label>
        <div className="flex items-center gap-2">
          <button className="border rounded px-4 py-2">Mentés</button>
          <span className="text-sm text-gray-600">{msg}</span>
        </div>
      </form>
    </main>
  );
}
