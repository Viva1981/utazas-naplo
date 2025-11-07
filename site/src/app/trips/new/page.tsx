"use client";
import { useState } from "react";

export default function NewTrip() {
  const [msg, setMsg] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget; // ez hiányzott
    const fd = new FormData(form);

    const payload = {
      title: String(fd.get("title") || ""),
      destination: String(fd.get("destination") || ""),
      start_date: String(fd.get("start_date") || ""),
      end_date: String(fd.get("end_date") || ""),
      visibility: String(fd.get("visibility") || "private"), // <<< ÚJ
    };

    const r = await fetch("/api/trips/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      credentials: "include",
    });

    const j = await r.json().catch(() => ({}));
    if (r.ok) {
      setMsg("Siker ✅ " + JSON.stringify(j));
      form.reset();
    } else {
      setMsg("Hiba ❌ " + JSON.stringify(j));
    }
  }

  return (
    <main style={{ padding: 24, maxWidth: 640 }}>
      <h1>Új út</h1>
      <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
        <input name="title" placeholder="Cím (pl. Róma hétvége)" required />
        <input name="destination" placeholder="Cél (pl. Róma, Olaszország)" required />
        <input type="date" name="start_date" required />
        <input type="date" name="end_date" required />

        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span>Láthatóság:</span>
          <select name="visibility" defaultValue="private">
            <option value="private">Privát</option>
            <option value="public">Publikus</option>
          </select>
        </label>

        <button style={{ padding: 8, border: "1px solid #ddd", borderRadius: 6 }}>
          Mentés
        </button>
      </form>
      <p>{msg}</p>
    </main>
  );
}

