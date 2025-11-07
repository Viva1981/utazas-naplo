"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

/* --- típusok (röviden) --- */
type Trip = {
  id: string; title: string; start_date?: string; end_date?: string;
  destination?: string; owner_user_id?: string; visibility?: "public"|"private";
};
type Photo = { id: string; trip_id: string; title?: string; drive_file_id: string; mimeType?: string; thumbnailLink?: string; archived_at?: string; };
type DocumentItem = { id: string; trip_id: string; title?: string; drive_file_id: string; mimeType?: string; thumbnailLink?: string; archived_at?: string; doc_visibility: "public"|"private"; };
type Expense = { id: string; trip_id: string; date: string; category: string; description: string; amount: number; currency: string; payment_method: string; };

function fmt(d?: string){ if(!d) return ""; const [Y,M,D]=d.split("-"); return `${Y}.${M}.${D}`; }

/* -------------------- LIGHTBOX / MODAL -------------------- */
function buildInlineUrl(mime: string | undefined, driveId: string) {
  const id = encodeURIComponent(driveId);
  if (mime?.startsWith("image/")) return `https://drive.google.com/uc?export=view&id=${id}`;
  if (mime === "application/pdf") return `https://drive.google.com/file/d/${id}/preview`;
  return `https://drive.google.com/file/d/${id}/view`;
}

function ViewerModal({
  open, onClose, title,
  type, // "photo" | "doc"
  driveId, mime,
  mediaId, // a saját (Photo/Document) id, fallbackhoz
}: {
  open: boolean; onClose: () => void; title?: string;
  type: "photo" | "doc"; driveId: string; mime?: string; mediaId?: string;
}) {
  if (!open) return null;
  const inlineUrl = buildInlineUrl(mime, driveId);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3" onClick={onClose}>
      <div className="bg-white max-w-5xl w-full rounded-xl shadow-2xl overflow-hidden" onClick={(e)=>e.stopPropagation()}>
        <div className="px-3 py-2 flex items-center justify-between border-b">
          <div className="font-medium truncate">{title || (mime?.startsWith("image/") ? "Kép" : "Dokumentum")}</div>
          <button onClick={onClose} className="text-sm px-3 py-1 border rounded-md hover:bg-gray-50">Bezárás</button>
        </div>

        <div className="bg-black/5">
          {mime?.startsWith("image/") ? (
            <div className="w-full grid place-items-center">
              <img
                src={inlineUrl}
                alt={title || "Kép"}
                className="max-h-[85vh] w-auto object-contain"
                style={{ display: "block" }}
                referrerPolicy="no-referrer"
                onError={(ev) => {
                  const img = ev.currentTarget as HTMLImageElement;
                  // 1) proxy endpoint (saját domain → kevesebb referrer para)
                  if (!img.dataset.step && mediaId) {
                    img.dataset.step = "file";
                    img.src = `/api/photos/file/${encodeURIComponent(mediaId)}`;
                    return;
                  }
                  // 2) végső fallback: nyers letöltő link, amit a legtöbb kép megjelenít
                  if (img.dataset.step !== "download") {
                    img.dataset.step = "download";
                    img.src = `https://drive.google.com/uc?id=${encodeURIComponent(driveId)}&export=download`;
                  }
                }}
              />
            </div>
          ) : (
            <iframe
              src={inlineUrl}
              title={title || "Dokumentum"}
              className="w-full"
              style={{ height: "85vh", border: 0 }}
              allow="autoplay; fullscreen"
            />
          )}
        </div>
      </div>
    </div>
  );
}

/* -------------------- OLDAL -------------------- */
export default function Page(){
  const { id } = useParams<{id:string}>();
  return <TripDetail key={id} id={String(id)} />;
}

function TripDetail({ id }: { id: string }) {
  const { data: sess } = useSession();
  const router = useRouter();

  const [trip, setTrip] = useState<Trip | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [docs, setDocs] = useState<DocumentItem[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [notFound, setNotFound] = useState(false);

  // viewer state
  const [viewer, setViewer] = useState<{
    type: "photo" | "doc"; driveId: string; mime?: string; title?: string; mediaId?: string;
  }|null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const r = await fetch(`/api/trips/get/${id}`, { cache: "no-store" });
      if (!r.ok) { if(alive) setNotFound(true); return; }
      const t: Trip = await r.json(); if(!alive) return;
      setTrip(t);
      const [p,d,e] = await Promise.all([
        fetch(`/api/photos/list?trip_id=${id}`, { cache:"no-store" }).then(r=>r.ok?r.json():[]),
        fetch(`/api/documents/list?trip_id=${id}`, { cache:"no-store" }).then(r=>r.ok?r.json():[]),
        fetch(`/api/expenses/list?trip_id=${id}`, { cache:"no-store" }).then(r=>r.ok?r.json():[]),
      ]);
      if(!alive) return;
      setPhotos(Array.isArray(p)?p:[]);
      setDocs(Array.isArray(d)?d:[]);
      setExpenses(Array.isArray(e)?e:[]);
    })();
    return ()=>{ alive=false; };
  }, [id]);

  if (notFound) return <main className="p-6"><h2>Nincs ilyen út</h2></main>;
  if (!trip) return <main className="p-6"><p>Betöltés…</p></main>;

  const isOwner = !!sess?.user?.email && trip.owner_user_id?.toLowerCase() === sess.user.email.toLowerCase();

  /* ----- RELEVÁNS RÉSZEK: fejlécben NINCS drive-link ----- */
  return (
    <main className="p-6 grid gap-6">
      <section className="border rounded-lg p-4 bg-white">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold mb-1">{trip.title}</h1>
            <div className="text-gray-600">
              {trip.destination} • {fmt(trip.start_date)} → {fmt(trip.end_date)}
            </div>
            {trip.visibility === "private" && (
              <div className="mt-1 inline-block text-[11px] px-2 py-0.5 rounded-full bg-black/70 text-white">Privát út</div>
            )}
          </div>
        </div>
      </section>

      {/* --- FOTÓK --- */}
      <section className="border rounded-lg p-3 grid gap-3">
        <h2 className="text-lg font-medium">📸 Fotók</h2>
        {photos.length === 0 ? (
          <em className="text-gray-600">Még nincs kép.</em>
        ) : (
          <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(180px,1fr))" }}>
            {photos.map(p => (
              <button
                key={p.id}
                type="button"
                className="relative rounded overflow-hidden border bg-gray-50 hover:shadow transition"
                onClick={() => setViewer({ type:"photo", driveId: p.drive_file_id, mime: p.mimeType, title: p.title, mediaId: p.id })}
                title={p.title || "Kép"}
              >
                <img
                  src={`/api/photos/thumb/${encodeURIComponent(p.id)}`}
                  alt={p.title || "kép"}
                  loading="lazy"
                  className="w-full h-auto object-cover"
                />
                {p.title && <div className="p-2 border-t bg-white text-sm truncate">{p.title}</div>}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* --- DOKUMENTUMOK (változatlan viselkedés, modalban nyílik) --- */}
      <section className="border rounded-lg p-3 grid gap-3">
        <h2 className="text-lg font-medium">📄 Dokumentumok</h2>
        {docs.length === 0 ? (
          <em className="text-gray-600">Nincs dokumentum.</em>
        ) : (
          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px,1fr))" }}>
            {docs.map(d => (
              <button
                key={d.id}
                type="button"
                className="relative border rounded-lg overflow-hidden bg-white shadow-sm"
                onClick={() => setViewer({ type:"doc", driveId: d.drive_file_id, mime: d.mimeType, title: d.title, mediaId: d.id })}
                title={d.title || "Dokumentum"}
              >
                <div className="w-full bg-gray-100" style={{ aspectRatio:"4/3" }}>
                  <img
                    src={`/api/documents/thumb/${encodeURIComponent(d.id)}`}
                    alt={d.title || "Előnézet"}
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="p-3 border-t bg-white">
                  <div className="font-medium text-sm truncate">{d.title || d.mimeType || "dokumentum"}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* --- KÖLTÉSEK (változatlanul) --- */}
      <section className="border rounded-lg p-3">
        <h2 className="text-lg font-medium mb-2">💸 Költések</h2>
        <ul className="grid gap-2 mt-1">
          {expenses.map(ex => (
            <li key={ex.id} className="border rounded px-3 py-2 bg-white">
              <div className="font-medium">{ex.date} • {ex.category} • {ex.amount} {ex.currency}</div>
              <div className="text-xs text-gray-600">{ex.description} • Fizetés: {ex.payment_method}</div>
            </li>
          ))}
          {expenses.length === 0 && <em className="text-gray-600">Még nincs költés.</em>}
        </ul>
      </section>

      {/* ---- MODAL ---- */}
      {viewer && (
        <ViewerModal
          open={!!viewer}
          onClose={() => setViewer(null)}
          title={viewer.title}
          type={viewer.type}
          driveId={viewer.driveId}
          mime={viewer.mime}
          mediaId={viewer.mediaId}
        />
      )}
    </main>
  );
}
