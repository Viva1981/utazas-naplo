"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
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
  const router = useRouter();

  const [trip, setTrip] = useState<Trip | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [docs, setDocs] = useState<DocumentItem[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [msgPhotos, setMsgPhotos] = useState("");
  const [msgDocs, setMsgDocs] = useState("");
  const [msgExp, setMsgExp] = useState("");
  const [notFound, setNotFound] = useState(false);

  async function refreshAll() {
    const [pRes, dRes, eRes] = await Promise.all([
      fetch(`/api/photos/list?trip_id=${id}`, { cache: "no-store" }),
      fetch(`/api/documents/list?trip_id=${id}`, { cache: "no-store" }),
      fetch(`/api/expenses/list?trip_id=${id}`, { cache: "no-store" }),
    ]);
    const pJson = pRes.ok ? await pRes.json().catch(() => []) : [];
    const dJson = dRes.ok ? await dRes.json().catch(() => []) : [];
    const eJson = eRes.ok ? await eRes.json().catch(() => []) : [];
    setPhotos(Array.isArray(pJson) ? pJson : []);
    setDocs(Array.isArray(dJson) ? dJson : []);
    setExpenses(Array.isArray(eJson) ? eJson : []);
  }

  useEffect(() => {
    let alive = true;
    setTrip(null);
    setPhotos([]);
    setDocs([]);
    setExpenses([]);
    setNotFound(false);
    (async () => {
      const r = await fetch(`/api/trips/get/${id}`, { cache: "no-store" });
      if (!r.ok) {
        if (alive) setNotFound(true);
        return;
      }
      const t: Trip = await r.json().catch(() => null as any);
      if (!alive) return;
      setTrip(t);
      await refreshAll();
    })();
    return () => { alive = false; };
  }, [id]);

  const isOwner =
    !!trip && !!sess?.user?.email && !!trip.owner_user_id &&
    trip.owner_user_id.toLowerCase() === sess.user.email.toLowerCase();

  if (notFound) return <main className="p-6"><h2>Nincs ilyen út</h2></main>;
  if (!trip) return <main className="p-6"><p>Betöltés…</p></main>;

  async function handleUploadPhotos(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsgPhotos("Feltöltés…");
    const fd = new FormData(e.currentTarget);
    fd.set("tripId", id);
    fd.set("category", "image");   // Photos
    fd.set("sheet", "Photos");     // ide írunk
    const r = await fetch("/api/drive/upload", { method: "POST", body: fd, credentials: "include" });
    let j: any = null; try { j = await r.json(); } catch {}
    if (r.ok) {
      setMsgPhotos("Siker ✅");
      (e.currentTarget as HTMLFormElement).reset();
      await refreshAll();
      router.refresh();               // soft-reload
      // window.location.reload();     // ha nagyon biztosra mennénk
    } else {
      setMsgPhotos("Hiba ❌ " + (j?.error || r.status));
    }
  }

  async function handleUploadDocs(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsgDocs("Feltöltés…");
    const fd = new FormData(e.currentTarget);
    fd.set("tripId", id);
    fd.set("category", "document");  // Documents
    fd.set("sheet", "Documents");    // ide írunk
    if (!fd.get("doc_visibility")) fd.set("doc_visibility", "private");
    const r = await fetch("/api/drive/upload", { method: "POST", body: fd, credentials: "include" });
    let j: any = null; try { j = await r.json(); } catch {}
    if (r.ok) {
      setMsgDocs("Siker ✅");
      (e.currentTarget as HTMLFormElement).reset();
      await refreshAll();
      router.refresh();               // soft-reload
      // window.location.reload();
    } else {
      setMsgDocs("Hiba ❌ " + (j?.error || r.status));
    }
  }

  async function handleAddExpense(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsgExp("Mentés…");
    const fd = new FormData(e.currentTarget);
    const payload = {
      trip_id: id,
      date: String(fd.get("date") || ""),
      category: String(fd.get("category") || "other"),
      description: String(fd.get("description") || ""),
      amount: Number(fd.get("amount") || 0),
      currency: String(fd.get("currency") || "HUF"),
      payment_method: String(fd.get("payment_method") || "card"),
    };
    const r = await fetch("/api/expenses/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      credentials: "include",
    });
    let j: any = null; try { j = await r.json(); } catch {}
    if (r.ok) {
      setMsgExp("Siker ✅");
      (e.currentTarget as HTMLFormElement).reset();
      await refreshAll();
      router.refresh();
    } else {
      setMsgExp("Hiba ❌ " + (j?.error || r.status));
    }
  }

  return (
    <main className="p-6 grid gap-6">
      {/* FEJLÉC */}
      <section>
        <h1 className="text-2xl font-semibold mb-1">{trip.title}</h1>
        <div className="text-gray-600">
          {trip.destination} • {niceDate(trip.start_date)} → {niceDate(trip.end_date)}
        </div>
        {trip.drive_folder_link && (
          <a
            href={trip.drive_folder_link}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-blue-600 underline inline-block mt-1"
          >
            📁 Megnyitás a Google Drive-ban
          </a>
        )}
      </section>

      {/* FOTÓK */}
      <section className="border rounded-lg p-3 grid gap-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-medium">📸 Fotók</h2>
        </div>

        {isOwner && (
          <form onSubmit={handleUploadPhotos} className="flex flex-wrap items-center gap-2">
            <input type="file" name="file" accept="image/*" multiple required />
            <input type="text" name="title" placeholder="Cím (opcionális)" className="border rounded px-2 py-1" />
            <button className="border rounded px-3 py-1">Feltöltés</button>
            <p className="text-sm text-gray-600">{msgPhotos}</p>
          </form>
        )}

        {photos.length === 0 ? (
          <em className="text-gray-600">Még nincs kép.</em>
        ) : (
          <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))" }}>
            {photos.map((m) => {
              const thumb = `/api/photos/thumb/${encodeURIComponent(m.id)}`;
              const full = `/api/photos/file/${encodeURIComponent(m.id)}`;
              return (
                <a key={m.id} href={full} target="_blank" rel="noreferrer" className="block rounded overflow-hidden border bg-gray-50 hover:shadow">
                  <img
                    src={thumb}
                    alt={m.title || "kép"}
                    loading="lazy"
                    className="w-full h-auto object-cover"
                    onError={(ev) => {
                      const img = ev.currentTarget as HTMLImageElement;
                      if (!img.dataset.fallback) {
                        (img as any).dataset.fallback = "1";
                        img.src = `https://drive.google.com/uc?export=view&id=${m.drive_file_id}`;
                      }
                    }}
                  />
                </a>
              );
            })}
          </div>
        )}
      </section>

      {/* DOKUMENTUMOK */}
      <section className="border rounded-lg p-3 grid gap-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-medium">📄 Dokumentumok</h2>
        </div>

        {isOwner && (
          <form onSubmit={handleUploadDocs} className="flex flex-wrap items-center gap-2">
            <input
              type="file"
              name="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ods,.txt,image/*"
              multiple
              required
            />
            <input type="text" name="title" placeholder="Cím (opcionális)" className="border rounded px-2 py-1" />
            <select name="doc_visibility" defaultValue="private" className="border rounded px-2 py-1">
              <option value="private">Privát</option>
              <option value="public">Publikus</option>
            </select>
            <button className="border rounded px-3 py-1">Feltöltés</button>
            <p className="text-sm text-gray-600">{msgDocs}</p>
          </form>
        )}

        {docs.length === 0 ? (
          <em className="text-gray-600">Nincs dokumentum.</em>
        ) : (
          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
            {docs.map((d) => {
              const thumb = `/api/documents/thumb/${encodeURIComponent(d.id)}`;
              const full = `/api/documents/file/${encodeURIComponent(d.id)}`;
              return (
                <article key={d.id} className="cursor-pointer border rounded-lg overflow-hidden bg-white shadow-sm">
                  <a href={full} target="_blank" rel="noreferrer">
                    <div className="bg-gray-100" style={{ aspectRatio: "4/3" }}>
                      <img
                        src={thumb}
                        alt={d.title || "Előnézet"}
                        className="w-full h-full object-contain"
                        onError={(ev) => {
                          const img = ev.currentTarget as HTMLImageElement;
                          if (!(img as any).dataset.fallback) {
                            (img as any).dataset.fallback = "1";
                            img.src = `https://drive.google.com/uc?export=view&id=${d.drive_file_id}`;
                          }
                        }}
                      />
                    </div>
                    <div className="p-3 flex items-center justify-between gap-2">
                      <div className="font-medium text-sm truncate">
                        {d.title || d.mimeType || "dokumentum"}
                      </div>
                      {d.doc_visibility === "private" && (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-black/70 text-white">Privát</span>
                      )}
                    </div>
                  </a>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* KÖLTÉSEK */}
      <section className="border rounded-lg p-3">
        <h2 className="text-lg font-medium mb-2">💸 Költések</h2>

        {isOwner ? (
          <form onSubmit={handleAddExpense} className="grid gap-2 max-w-md">
            <input type="date" name="date" required className="border rounded px-2 py-1" />
            <input name="category" placeholder="Kategória (pl. food, transport)" defaultValue="food" className="border rounded px-2 py-1" />
            <input name="description" placeholder="Megjegyzés" className="border rounded px-2 py-1" />
            <input name="amount" type="number" step="0.01" placeholder="Összeg" required className="border rounded px-2 py-1" />
            <input name="currency" placeholder="Pénznem" defaultValue="HUF" className="border rounded px-2 py-1" />
            <input name="payment_method" placeholder="Fizetési mód" defaultValue="card" className="border rounded px-2 py-1" />
            <div className="flex items-center gap-2">
              <button className="border rounded px-3 py-1">Mentés</button>
              <span className="text-sm text-gray-600">{msgExp}</span>
            </div>
          </form>
        ) : (
          <em>Csak a tulajdonos rögzíthet költéseket ehhez az úthoz.</em>
        )}

        <ul className="grid gap-2 mt-3">
          {expenses.map((ex) => (
            <li key={ex.id} className="border rounded px-3 py-2">
              <div className="font-medium">
                {ex.date} • {ex.category} • {ex.amount} {ex.currency}
              </div>
              <div className="text-xs text-gray-600">
                {ex.description} • Fizetés: {ex.payment_method}
              </div>
            </li>
          ))}
          {expenses.length === 0 && <em className="text-gray-600">Még nincs költés.</em>}
        </ul>
      </section>
    </main>
  );
}
