"use client";
import { useState } from "react";

export default function TestDrive() {
  const [msg, setMsg] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg("Feltöltés...");
    const fd = new FormData(e.currentTarget);
    const r = await fetch("/api/drive/upload", { method: "POST", body: fd });
    const j = await r.json();
    if (r.ok) setMsg("Siker ✅ " + JSON.stringify(j));
    else setMsg("Hiba ❌ " + JSON.stringify(j));
  }

  return (
    <main style={{ padding: 24 }}>
      <h1>Drive feltöltés teszt</h1>
      <form onSubmit={onSubmit}>
        <input type="file" name="file" required />
        <button style={{ marginLeft: 8, padding: 8, border: "1px solid #ddd", borderRadius: 6 }}>
          Feltöltés
        </button>
      </form>
      <p>{msg}</p>
    </main>
  );
}
