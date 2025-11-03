"use client";
import { useState } from "react";

export default function TestSheets() {
  const [status, setStatus] = useState<string>("");

  async function addRow() {
    setStatus("Küldöm...");
    const resp = await fetch("/api/sheets/append", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        values: [new Date().toISOString().slice(0,10), "Hello Sheets!", "Utazás Napló"],
      }),
    });
    const json = await resp.json();
    if (resp.ok) setStatus("Siker ✅: " + JSON.stringify(json));
    else setStatus("Hiba ❌: " + JSON.stringify(json));
  }

  return (
    <main style={{ padding: 24 }}>
      <h1>Sheets teszt</h1>
      <button onClick={addRow} style={{ padding: 8, border: "1px solid #ddd", borderRadius: 6 }}>
        Sor hozzáadása
      </button>
      <p>{status}</p>
    </main>
  );
}
