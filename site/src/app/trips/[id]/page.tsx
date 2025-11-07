"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";

type Trip = {
  id: string;
  title: string;
  start_date?: string;
  end_date?: string;
  destination?: string;
  owner_user_id?: string;
  visibility?: "public" | "private";
  drive_folder_link?: string;
};

type Photo = {
  id: string;
  trip_id: string;
  title?: string;
  drive_file_id: string;
  mimeType?: string;
  thumbnailLink?: string;
  uploader_user_id?: string;
  archived_at?: string;
};

type DocumentItem = {
  id: string;
  trip_id: string;
  title?: string;
  drive_file_id: string;
  mimeType?: string;
  thumbnailLink?: string;
  uploader_user_id?: string;
  archived_at?: string;
  doc_visibility: "public" | "private";
};

type Expense = {
  id: string;
  trip_id: string;
  date: string;
  category: string;
  description: string;
  amount: number;
  currency: string;
  payment_method: string;
};

function niceDate(d?: string) {
  if (!d) return "";
  const [Y, M, D] = d.split("-");
  return `${Y}.${M}.${D}`;
}

export default function Page() {
  const { id } = useParams<{ id: string }>();
  return <TripDetail key={id} id={String(id)} />;
}

function TripDetail({ id }: { id: string }) {
  const { data: sess } = useSession();

  const [trip, setTrip] = useState<Trip | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [docs, setDocs] = useState<DocumentItem[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [uploadMsg, setUploadMsg] = useState("");
  const [expMsg, setExpMsg] = useState("");
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let alive = true;
    setTrip(null);
    setPhotos([]);
    setDocs([]);
    setExpenses([]);
    setNotFound(false);

    (async () => {
      // TRIP
      const r = await fetch(`/api/trips/get/${id}`, { cache: "no-store" });
      if (!r.ok) {
        setNotFound(true);
        return;
      }
      const t: Trip = await r.json().catch(() => null as any);
      if (!alive) return;
      setTrip(t);

      // PHOTOS
      const pRes = await fetch(`/api/photos/list?trip_id=${id}`, { cache: "no-store" });
      const pJson = pRes.ok ? await pRes.json().catch(() => []) : [];
      if (alive) setPhotos(Array.isArray(pJson) ? pJson : []);

      // DOCUMENTS
      const dRes = await fetch(`/api/documents/list?trip_id=${id}`, { cache: "no-store" });
      const dJson = dRes.ok ? await dRes.json().catch(() => []) : [];
      if (alive) setDocs(Array.isArray(dJson) ? dJson : []);

      // EXPENSES
      const eRes = await fetch(`/api/expenses/list?trip_id=${id}`, { cache: "no-store" });
      const eJson = eRes.ok ? await eRes.json().catch(() => []) : [];
      if (alive) setExpenses(Array.isArray(eJson) ? eJson : []);
    })();

    return () => { alive = false; };
  }, [id]);

  const isOwner =
    !!trip && !!sess?.user?.email && !!trip.owner_user_id &&
    trip.owner_user_id.toLowerCase() === sess.user.email.toLowerCase();

  if (notFound) return <main style={{ padding: 24 }}><h2>Nincs ilyen út</h2></main>;
  if (!trip) return <main style={{ padding: 24 }}><p>Betöltés…</p></main>;

  return (
    <main style={{ padding: 24, display: "grid", gap: 24 }}>
      {/* FEJLÉC */}
      <section>
        <h1 style={{ marginBottom: 8 }}>{trip.title}</h1>
        <div style={{ color: "#666" }}>
          {trip.destination} • {niceDate(trip.start_date)} → {niceDate(trip.end_date)}
        </div>
        {trip.drive_folder_link && (
          <a
            href={trip.drive_folder_link}
            target="_blank"
            rel="noreferrer"
            className="text-sm underline"
            style={{ display: "inline-block", marginTop: 6 }}
          >
            📁 Megnyitás a Google Drive-ban
          </a>
        )}
      </section>

      {/* FOTÓK */}
      <section style={{ border: "1px solid #eee", borderRadius: 8, padding: 12, display: "grid", gap: 12 }}>
        <h2 style={{ margin: 0 }}>📸 Fotók</h2>
        {photos.length === 0 ? (
          <em style={{ color: "#666" }}>Még nincs kép.</em>
        ) : (
          <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))" }}>
            {photos.map((m) => {
              const thumb = `/api/photos/thumb/${encodeURIComponent(m.id)}`;
              const full  = `/api/photos/file/${encodeURIComponent(m.id)}`;
              const canDelete =
                (!!m.uploader_user_id && !!sess?.user?.email && m.uploader_user_id.toLowerCase() === sess.user.email.toLowerCase()) ||
                isOwner;
              return (
                <div key={m.id} style={{ display: "grid", gap: 6 }}>
                  <a href={full} target="_blank" rel="noreferrer" title={m.title || "Kép megnyitása"}>
                    <div style={{ position: "relative", width: "100%", paddingTop: "75%", background: "#f7f7f7", borderRadius: 8, overflow: "hidden" }}>
                      <img
                        src={thumb}
                        alt={m.title || "kép"}
                        loading="lazy"
                        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                        onError={(ev) => {
                          const img = ev.currentTarget as HTMLImageElement;
                          if (!img.dataset.fallback) {
                            (img as any).dataset.fallback = "1";
                            img.src = `https://drive.google.com/uc?export=view&id=${m.drive_file_id}`;
                          }
                        }}
                      />
                    </div>
                  </a>
                  {canDelete && (
                    <button
                      onClick={() => fetch(`/api/photos/${m.id}`, { method: "DELETE" }).then(() => location.reload())}
                      style={{ padding: "6px 10px", border: "1px solid #e33", borderRadius: 6, background: "#fff", color: "#e33", cursor: "pointer", justifySelf: "start" }}
                    >
                      Törlés
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* DOKUMENTUMOK */}
      <section style={{ border: "1px solid #eee", borderRadius: 8, padding: 12, display: "grid", gap: 12 }}>
        <h2 style={{ margin: 0 }}>📄 Dokumentumok</h2>

        {docs.length === 0 ? (
          <em style={{ color: "#666" }}>Nincs dokumentum.</em>
        ) : (
          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
            {docs.map((d) => {
              const thumb = `/api/documents/thumb/${encodeURIComponent(d.id)}`;
              const full  = `/api/documents/file/${encodeURIComponent(d.id)}`;
              const canDelete =
                (!!d.uploader_user_id && !!sess?.user?.email && d.uploader_user_id.toLowerCase() === sess.user.email.toLowerCase()) ||
                isOwner;
              return (
                <article key={d.id} style={{ cursor: "pointer", border: "1px solid #eee", borderRadius: 12, overflow: "hidden", background: d.doc_visibility === "public" ? "#fff" : "#fafafa", boxShadow: "0 1px 3px rgba(0,0,0,.06)" }}>
                  <a href={full} target="_blank" rel="noreferrer" title={d.title || "Megnyitás"}>
                    <div style={{ position: "relative", background: "#f5f5f5", aspectRatio: "4/3" }}>
                      <img
                        src={thumb}
                        alt={d.title || "Dokumentum előnézet"}
                        style={{ width: "100%", height: "100%", objectFit: "contain", background: "#fff" }}
                        onError={(ev) => {
                          const img = ev.currentTarget as HTMLImageElement;
                          if (!(img as any).dataset.fallback) {
                            (img as any).dataset.fallback = "1";
                            img.src = `https://drive.google.com/uc?export=view&id=${d.drive_file_id}`;
                          }
                        }}
                      />
                      {d.doc_visibility === "private" && (
                        <span style={{ position: "absolute", top: 8, right: 8, background: "rgba(0,0,0,.6)", color: "#fff", fontSize: 12, padding: "2px 8px", borderRadius: 999 }}>
                          Privát
                        </span>
                      )}
                    </div>
                  </a>
                  <div style={{ padding: 12, display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 600, fontSize: 13 }}>
                      {d.title || d.mimeType || "dokumentum"}
                    </div>
                    {canDelete && (
                      <button
                        onClick={(e) => { e.preventDefault(); fetch(`/api/documents/${d.id}`, { method: "DELETE" }).then(() => location.reload()); }}
                        style={{ padding: "4px 8px", border: "1px solid #e33", borderRadius: 6, background: "#fff", color: "#e33", cursor: "pointer", fontSize: 12 }}
                      >
                        Törlés
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* KÖLTÉSEK – marad a régi logika */}
      <section style={{ border: "1px solid #eee", borderRadius: 8, padding: 12 }}>
        <h2>Költések</h2>
        <ul style={{ display: "grid", gap: 8, marginTop: 8 }}>
          {expenses.map((ex) => (
            <li key={ex.id} style={{ border: "1px solid #f0f0f0", borderRadius: 6, padding: 8 }}>
              <div style={{ fontWeight: 600 }}>
                {ex.date} • {ex.category} • {ex.amount} {ex.currency}
              </div>
              <div style={{ fontSize: 12, color: "#666" }}>
                {ex.description} • Fizetés: {ex.payment_method}
              </div>
            </li>
          ))}
          {expenses.length === 0 && <em>Még nincs költés.</em>}
        </ul>
      </section>
    </main>
  );
}
