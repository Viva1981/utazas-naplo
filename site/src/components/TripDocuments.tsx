"use client";

import { useEffect, useState } from "react";

type DocItem = {
  id: string;
  title: string;
  thumbUrl: string;
  drive_file_id: string;
  media_visibility: "public" | "private";
};

function iconFor(title: string) {
  const t = title.toLowerCase();
  if (t.endsWith(".pdf")) return "📄";
  if (t.endsWith(".doc") || t.endsWith(".docx")) return "📝";
  if (t.endsWith(".xls") || t.endsWith(".xlsx")) return "📊";
  if (t.endsWith(".png") || t.endsWith(".jpg") || t.endsWith(".jpeg")) return "🖼️";
  return "📎";
}

export default function TripDocuments({ tripId }: { tripId: string }) {
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [isOwner, setIsOwner] = useState(false);
  const [isTripPublic, setIsTripPublic] = useState(false);

  useEffect(() => {
    (async () => {
      const r = await fetch(`/api/trips/${tripId}/media`, { cache: "no-store" });
      const j = await r.json();
      setDocs(j.documents || []);
      setIsOwner(!!j.is_owner);
      setIsTripPublic(!!j.is_trip_public);
    })();
  }, [tripId]);

  async function toggleVisibility(id: string, current: "public" | "private") {
    // Itt egy POST /api/media/visibility endpoint-ot hívjunk (alább vázolva)
    await fetch(`/api/media/visibility`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ media_id: id, media_visibility: current === "public" ? "private" : "public" }),
    });
    // Frissítés
    const r = await fetch(`/api/trips/${tripId}/media`, { cache: "no-store" });
    const j = await r.json();
    setDocs(j.documents || []);
  }

  return (
    <section style={{ display: "grid", gap: 12 }}>
      <h3 style={{ margin: 0 }}>Dokumentumok</h3>

      {docs.length === 0 ? (
        <div style={{ color: "#666" }}>Nincs dokumentum.</div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {docs.map((d) => (
            <div
              key={d.id}
              style={{
                border: "1px solid #eee",
                borderRadius: 8,
                padding: "8px 12px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <a
                href={`/api/media/file/${d.drive_file_id}`}
                target="_blank"
                style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", color: "inherit" }}
              >
                <span style={{ fontSize: 20 }}>{iconFor(d.title)}</span>
                <span>{d.title || "Dokumentum"}</span>
              </a>

              {isOwner && isTripPublic && (
                <button
                  onClick={() => toggleVisibility(d.id, d.media_visibility)}
                  style={{ fontSize: 12, border: "1px solid #ddd", borderRadius: 6, padding: "6px 8px", background: "#fff" }}
                  title="Publikus/Privát váltás"
                >
                  {d.media_visibility === "private" ? "Privát" : "Publikus"}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
