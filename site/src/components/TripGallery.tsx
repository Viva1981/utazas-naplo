"use client";

import { useEffect, useState } from "react";

type MediaItem = {
  id: string;
  title: string;
  thumbUrl: string;
  drive_file_id: string;
};

export default function TripGallery({ tripId }: { tripId: string }) {
  const [images, setImages] = useState<MediaItem[]>([]);
  const [isOwner, setIsOwner] = useState(false);
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      const r = await fetch(`/api/trips/${tripId}/media`, { cache: "no-store" });
      const j = await r.json();
      setImages(j.images || []);
      setIsOwner(!!j.is_owner);
    })();
  }, [tripId]);

  const remaining = Math.max(0, 3 - images.length);

  return (
    <section style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <h3 style={{ margin: 0 }}>Fotók</h3>
        {isOwner && remaining > 0 && (
          <form
            action="/api/media/upload"
            method="post"
            encType="multipart/form-data"
            onSubmit={(e) => {
              // opcionális: további validálás
            }}
          >
            <input type="hidden" name="trip_id" value={tripId} />
            <input type="hidden" name="category" value="image" />
            <input type="file" name="files" multiple accept="image/*" />
            <button type="submit">Feltöltés ({remaining} hely)</button>
          </form>
        )}
      </div>

      {images.length === 0 ? (
        <div style={{ color: "#666" }}>Még nincs kép.</div>
      ) : (
        <div
          style={{
            display: "grid",
            gap: 8,
            gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
          }}
        >
          {images.map((m, i) => (
            <button
              key={m.id}
              onClick={() => setOpenIndex(i)}
              style={{
                border: "none",
                padding: 0,
                borderRadius: 8,
                overflow: "hidden",
                background: "transparent",
                cursor: "zoom-in",
              }}
            >
              <img
                src={m.thumbUrl}
                alt={m.title || `Kép ${i + 1}`}
                style={{ width: "100%", height: 140, objectFit: "cover", display: "block" }}
                loading="lazy"
              />
            </button>
          ))}
        </div>
      )}

      {openIndex !== null && (
        <dialog open style={{ border: "none", padding: 0, background: "transparent" }}>
          <div
            onClick={() => setOpenIndex(null)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,.8)",
              display: "grid",
              placeItems: "center",
              cursor: "zoom-out",
            }}
          >
            <img
              src={images[openIndex].thumbUrl}
              alt={images[openIndex].title || ""}
              style={{ maxWidth: "90vw", maxHeight: "85vh", objectFit: "contain" }}
            />
          </div>
        </dialog>
      )}
    </section>
  );
}
