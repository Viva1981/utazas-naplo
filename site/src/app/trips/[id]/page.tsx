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

  // kebab/inline title state (media)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [editTitleId, setEditTitleId] = useState<string | null>(null);
  const [editTitleValue, setEditTitleValue] = useState<string>("");

  // expenses inline edit
  const [editExpId, setEditExpId] = useState<string | null>(null);
  const [editExp, setEditExp] = useState<Partial<Expense>>({});

  // trip edit
  const [editTripMode, setEditTripMode] = useState(false);
  const [tripForm, setTripForm] = useState<Partial<Trip>>({});

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
      setTripForm({
        title: t.title,
        start_date: t.start_date,
        end_date: t.end_date,
        destination: t.destination,
        visibility: t.visibility,
      });
      await refreshAll();
    })();
    return () => { alive = false; };
  }, [id]);

  const isOwner =
    !!trip && !!sess?.user?.email && !!trip.owner_user_id &&
    trip.owner_user_id.toLowerCase() === sess.user.email.toLowerCase();

  if (notFound) return <main className="p-6"><h2>Nincs ilyen út</h2></main>;
  if (!trip) return <main className="p-6"><p>Betöltés…</p></main>;

  // ======== UPLOAD HANDLERS (media) ========
  async function handleUploadPhotos(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsgPhotos("Feltöltés…");
    const fd = new FormData(e.currentTarget);
    fd.set("tripId", id);
    fd.set("category", "image");
    fd.set("sheet", "Photos");
    const r = await fetch("/api/drive/upload", { method: "POST", body: fd, credentials: "include" });
    let j: any = null; try { j = await r.json(); } catch {}
    if (r.ok) {
      setMsgPhotos("Siker ✅");
      (e.currentTarget as HTMLFormElement).reset();
      await refreshAll();
      router.refresh();
    } else {
      setMsgPhotos("Hiba ❌ " + (j?.error || r.status));
    }
  }
  async function handleUploadDocs(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsgDocs("Feltöltés…");
    const fd = new FormData(e.currentTarget);
    fd.set("tripId", id);
    fd.set("category", "document");
    fd.set("sheet", "Documents");
    if (!fd.get("doc_visibility")) fd.set("doc_visibility", "private");
    const r = await fetch("/api/drive/upload", { method: "POST", body: fd, credentials: "include" });
    let j: any = null; try { j = await r.json(); } catch {}
    if (r.ok) {
      setMsgDocs("Siker ✅");
      (e.currentTarget as HTMLFormElement).reset();
      await refreshAll();
      router.refresh();
    } else {
      setMsgDocs("Hiba ❌ " + (j?.error || r.status));
    }
  }

  // ======== MEDIA EDIT/TGL/DELETE ========
  function openEdit(mid: string, currentTitle?: string) {
    setOpenMenuId(null);
    setEditTitleId(mid);
    setEditTitleValue(currentTitle || "");
  }
  function closeEdit() {
    setEditTitleId(null);
    setEditTitleValue("");
  }
  async function savePhotoTitle(photoId: string) {
    const r = await fetch(`/api/photos/${encodeURIComponent(photoId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: editTitleValue }),
      credentials: "include",
    });
    if (r.ok) { closeEdit(); await refreshAll(); router.refresh(); }
  }
  async function saveDocTitle(docId: string) {
    const r = await fetch(`/api/documents/${encodeURIComponent(docId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: editTitleValue }),
      credentials: "include",
    });
    if (r.ok) { closeEdit(); await refreshAll(); router.refresh(); }
  }
  async function toggleDocVisibility(d: DocumentItem) {
    const next = d.doc_visibility === "public" ? "private" : "public";
    const r = await fetch(`/api/documents/${encodeURIComponent(d.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ doc_visibility: next }),
      credentials: "include",
    });
    if (r.ok) { setOpenMenuId(null); await refreshAll(); router.refresh(); }
  }
  async function deletePhoto(photoId: string) {
    if (!confirm("Biztosan törlöd ezt a fotót? (Visszavonhatatlan)")) return;
    const r = await fetch(`/api/photos/${encodeURIComponent(photoId)}`, { method: "DELETE", credentials: "include" });
    if (r.ok) { setOpenMenuId(null); await refreshAll(); router.refresh(); }
  }
  async function deleteDoc(docId: string) {
    if (!confirm("Biztosan törlöd ezt a dokumentumot? (Visszavonhatatlan)")) return;
    const r = await fetch(`/api/documents/${encodeURIComponent(docId)}`, { method: "DELETE", credentials: "include" });
    if (r.ok) { setOpenMenuId(null); await refreshAll(); router.refresh(); }
  }

  // ======== EXPENSES EDIT/DELETE ========
  function openEditExp(ex: Expense) {
    setOpenMenuId(null);
    setEditExpId(ex.id);
    setEditExp({ ...ex });
  }
  function closeEditExp() {
    setEditExpId(null);
    setEditExp({});
  }
  async function saveExpense() {
    if (!editExpId) return;
    const payload = {
      date: editExp.date,
      category: editExp.category,
      description: editExp.description,
      amount: Number(editExp.amount),
      currency: editExp.currency,
      payment_method: editExp.payment_method,
    };
    const r = await fetch(`/api/expenses/${encodeURIComponent(editExpId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      credentials: "include",
    });
    if (r.ok) {
      closeEditExp();
      await refreshAll();
      router.refresh();
    }
  }
  async function deleteExpense(expId: string) {
    if (!confirm("Biztosan törlöd ezt a költést? (Visszavonhatatlan)")) return;
    const r = await fetch(`/api/expenses/${encodeURIComponent(expId)}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (r.ok) {
      setOpenMenuId(null);
      await refreshAll();
      router.refresh();
    }
  }

  // ======== TRIP EDIT ========
  function beginTripEdit() { setEditTripMode(true); }
  function cancelTripEdit() {
    if (trip) {
      setTripForm({
        title: trip.title,
        start_date: trip.start_date,
        end_date: trip.end_date,
        destination: trip.destination,
        visibility: trip.visibility,
      });
    }
    setEditTripMode(false);
  }
  async function saveTripEdit() {
    const payload: any = {};
    if (typeof tripForm.title === "string") payload.title = tripForm.title;
    if (typeof tripForm.start_date === "string") payload.start_date = tripForm.start_date;
    if (typeof tripForm.end_date === "string") payload.end_date = tripForm.end_date;
    if (typeof tripForm.destination === "string") payload.destination = tripForm.destination;
    if (typeof tripForm.visibility === "string") payload.visibility = tripForm.visibility;

    const r = await fetch(`/api/trips/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      credentials: "include",
    });
    if (r.ok) {
      setEditTripMode(false);
      const r2 = await fetch(`/api/trips/get/${id}`, { cache: "no-store" });
      if (r2.ok) {
        const t: Trip = await r2.json().catch(() => null as any);
        if (t) setTrip(t);
      }
      router.refresh();
    }
  }

  return (
    <main className="p-6 grid gap-6">
      {/* FEJLÉC */}
      <section className="border rounded-lg p-4 bg-white">
        {!editTripMode ? (
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="text-2xl font-semibold mb-1">{trip!.title}</h1>
                <div className="text-gray-600">
                  {trip!.destination} • {niceDate(trip!.start_date)} → {niceDate(trip!.end_date)}
                </div>
                {trip!.visibility === "private" && (
                  <div className="mt-1 inline-block text-[11px] px-2 py-0.5 rounded-full bg-black/70 text-white">
                    Privát út
                  </div>
                )}
                {trip!.drive_folder_link && (
                  <div>
                    <a
                      href={trip!.drive_folder_link}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm text-blue-600 underline inline-block mt-1"
                    >
                      📁 Megnyitás a Google Drive-ban
                    </a>
                  </div>
                )}
              </div>
              {isOwner && (
                <button
                  onClick={beginTripEdit}
                  className="h-9 px-3 border rounded-md hover:bg-gray-50"
                >
                  Szerkesztés
                </button>
              )}
            </div>
          </>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="grid gap-1">
              <span className="text-xs text-gray-600">Cím</span>
              <input
                value={tripForm.title || ""}
                onChange={(e) => setTripForm(s => ({ ...s, title: e.target.value }))}
                className="border rounded px-2 py-1"
              />
            </label>
            <label className="grid gap-1">
              <span className="text-xs text-gray-600">Úti cél</span>
              <input
                value={tripForm.destination || ""}
                onChange={(e) => setTripForm(s => ({ ...s, destination: e.target.value }))}
                className="border rounded px-2 py-1"
              />
            </label>
            <label className="grid gap-1">
              <span className="text-xs text-gray-600">Kezdet</span>
              <input
                type="date"
                value={tripForm.start_date || ""}
                onChange={(e) => setTripForm(s => ({ ...s, start_date: e.target.value }))}
                className="border rounded px-2 py-1"
              />
            </label>
            <label className="grid gap-1">
              <span className="text-xs text-gray-600">Vége</span>
              <input
                type="date"
                value={tripForm.end_date || ""}
                onChange={(e) => setTripForm(s => ({ ...s, end_date: e.target.value }))}
                className="border rounded px-2 py-1"
              />
            </label>
            <label className="grid gap-1 sm:col-span-2">
              <span className="text-xs text-gray-600">Láthatóság</span>
              <select
                value={tripForm.visibility || "public"}
                onChange={(e) => setTripForm(s => ({ ...s, visibility: e.target.value as "public" | "private" }))}
                className="border rounded px-2 py-1"
              >
                <option value="public">Publikus</option>
                <option value="private">Privát</option>
              </select>
            </label>
            <div className="flex items-center gap-2 sm:col-span-2 mt-2">
              <button onClick={saveTripEdit} className="border rounded px-3 py-1">Mentés</button>
              <button onClick={cancelTripEdit} className="text-gray-600">Mégse</button>
            </div>
          </div>
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
          <MediaPhotoGrid
            tripId={id}
            items={photos}
            isOwner={isOwner}
            openMenuId={openMenuId}
            setOpenMenuId={setOpenMenuId}
            editTitleId={editTitleId}
            editTitleValue={editTitleValue}
            setEditTitleValue={setEditTitleValue}
            openEdit={openEdit}
            closeEdit={closeEdit}
            savePhotoTitle={savePhotoTitle}
            deletePhoto={deletePhoto}
          />
        )}
      </section>

      {/* DOKUMENTUMOK */}
      <section className="border rounded-lg p-3 grid gap-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-medium">📄 Dokumentumok</h2>
        </div>

        {isOwner && (
          <form onSubmit={handleUploadDocs} className="flex flex-wrap items-center gap-2">
            <input type="file" name="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ods,.txt,image/*" multiple required />
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
          <MediaDocGrid
            tripId={id}
            items={docs}
            isOwner={isOwner}
            openMenuId={openMenuId}
            setOpenMenuId={setOpenMenuId}
            editTitleId={editTitleId}
            editTitleValue={editTitleValue}
            setEditTitleValue={setEditTitleValue}
            openEdit={openEdit}
            closeEdit={closeEdit}
            saveDocTitle={saveDocTitle}
            toggleDocVisibility={toggleDocVisibility}
            deleteDoc={deleteDoc}
          />
        )}
      </section>

      {/* KÖLTÉSEK */}
      <ExpensesSection
        isOwner={isOwner}
        id={id}
        msgExp={msgExp}
        setMsgExp={setMsgExp}
        expenses={expenses}
        openMenuId={openMenuId}
        setOpenMenuId={setOpenMenuId}
        editExpId={editExpId}
        editExp={editExp}
        setEditExp={setEditExp}
        openEditExp={openEditExp}
        closeEditExp={closeEditExp}
        saveExpense={saveExpense}
        deleteExpense={deleteExpense}
      />
    </main>
  );
}

/* ==== Kisegítő al-komponensek ==== */
function MediaPhotoGrid(props: any) {
  const {
    tripId, items, isOwner, openMenuId, setOpenMenuId,
    editTitleId, editTitleValue, setEditTitleValue,
    openEdit, closeEdit, savePhotoTitle, deletePhoto,
  } = props;

  const onOpen = (photoId: string) => {
    // IN-APP: deep link → viewer modal
    window.location.href = `/trips/${encodeURIComponent(tripId)}/photos/${encodeURIComponent(photoId)}`;
  };

  const KebabBtn = ({ onClick }: { onClick: () => void }) => (
    <button type="button" onClick={onClick} className="absolute top-2 right-2 rounded-full p-1.5 bg-white/90 hover:bg-white shadow border" aria-label="Műveletek">
      <svg width="16" height="16" viewBox="0 0 24 24" className="opacity-80">
        <circle cx="5" cy="12" r="1.8"></circle><circle cx="12" cy="12" r="1.8"></circle><circle cx="19" cy="12" r="1.8"></circle>
      </svg>
    </button>
  );
  const MiniMenu = ({ children, onClose }: { children: React.ReactNode; onClose: () => void }) => (
    <div className="absolute top-10 right-2 z-10 bg-white border rounded-lg shadow-lg min-w-[160px]">
      <div className="p-1">{children}</div>
      <button type="button" onClick={onClose} className="w-full text-xs text-gray-500 py-1 hover:bg-gray-50 border-t">Bezár</button>
    </div>
  );

  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))" }}>
      {items.map((m: any) => {
        const thumb = `/api/photos/thumb/${encodeURIComponent(m.id)}`;
        const isEditing = editTitleId === m.id;
        return (
          <div key={m.id} className="relative rounded overflow-hidden border bg-gray-50 hover:shadow transition">
            <button type="button" className="block w-full text-left" onClick={() => onOpen(m.id)} aria-label="Megnyitás">
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
            </button>

            <div className="p-2 border-t bg-white flex items-center gap-2">
              {isEditing ? (
                <>
                  <input value={editTitleValue} onChange={(e) => setEditTitleValue(e.target.value)} className="border rounded px-2 py-1 text-sm w-full" placeholder="Cím" autoFocus />
                  <button className="text-xs border rounded px-2 py-1" onClick={() => savePhotoTitle(m.id)} type="button">Mentés</button>
                  <button className="text-xs text-gray-600" onClick={closeEdit} type="button">Mégse</button>
                </>
              ) : (
                <div className="text-sm truncate">{m.title || " "}</div>
              )}
            </div>

            {isOwner && (
              <>
                <KebabBtn onClick={() => setOpenMenuId(openMenuId === m.id ? null : m.id)} />
                {openMenuId === m.id && (
                  <MiniMenu onClose={() => setOpenMenuId(null)}>
                    <button type="button" className="w-full text-left text-sm px-3 py-2 hover:bg-gray-50 rounded" onClick={() => openEdit(m.id, m.title)}>✏️ Cím szerkesztése</button>
                    <button type="button" className="w-full text-left text-sm px-3 py-2 hover:bg-red-50 text-red-600 rounded" onClick={() => deletePhoto(m.id)}>🗑️ Törlés</button>
                  </MiniMenu>
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

function MediaDocGrid(props: any) {
  const {
    tripId, items, isOwner, openMenuId, setOpenMenuId,
    editTitleId, editTitleValue, setEditTitleValue,
    openEdit, closeEdit, saveDocTitle, toggleDocVisibility, deleteDoc,
  } = props;

  // DOCUMENTUM: új lapon nyitjuk a proxy URL-t → stabil PDF/office nézet minden böngészőben
  const onOpen = (docId: string) => {
    window.location.href = `/api/documents/file/${encodeURIComponent(docId)}`;
 };

  const KebabBtn = ({ onClick }: { onClick: () => void }) => (
    <button type="button" onClick={onClick} className="absolute top-2 right-2 rounded-full p-1.5 bg-white/90 hover:bg-white shadow border" aria-label="Műveletek">
      <svg width="16" height="16" viewBox="0 0 24 24" className="opacity-80">
        <circle cx="5" cy="12" r="1.8"></circle><circle cx="12" cy="12" r="1.8"></circle><circle cx="19" cy="12" r="1.8"></circle>
      </svg>
    </button>
  );
  const MiniMenu = ({ children, onClose }: { children: React.ReactNode; onClose: () => void }) => (
    <div className="absolute top-10 right-2 z-10 bg-white border rounded-lg shadow-lg min-w-[160px]">
      <div className="p-1">{children}</div>
      <button type="button" onClick={onClose} className="w-full text-xs text-gray-500 py-1 hover:bg-gray-50 border-t">Bezár</button>
    </div>
  );

  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
      {items.map((d: any) => {
        const thumb = `/api/documents/thumb/${encodeURIComponent(d.id)}`;
        const isEditing = editTitleId === d.id;

        return (
          <article key={d.id} className="relative border rounded-lg overflow-hidden bg-white shadow-sm">
            <button type="button" className="block w-full text-left" onClick={() => onOpen(d.id)} aria-label="Megnyitás">
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
            </button>

            <div className="p-3 border-t bg-white">
              {isEditing ? (
                <div className="flex items-center gap-2">
                  <input value={editTitleValue} onChange={(e) => setEditTitleValue(e.target.value)} className="border rounded px-2 py-1 text-sm w-full" placeholder="Cím" autoFocus />
                  <button className="text-xs border rounded px-2 py-1" onClick={() => saveDocTitle(d.id)} type="button">Mentés</button>
                  <button className="text-xs text-gray-600" onClick={closeEdit} type="button">Mégse</button>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <div className="font-medium text-sm truncate">{d.title || d.mimeType || "dokumentum"}</div>
                  {d.doc_visibility === "private" && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-black/70 text-white">Privát</span>
                  )}
                </div>
              )}
            </div>

            {isOwner && (
              <>
                <KebabBtn onClick={() => setOpenMenuId(openMenuId === d.id ? null : d.id)} />
                {openMenuId === d.id && (
                  <MiniMenu onClose={() => setOpenMenuId(null)}>
                    <button type="button" className="w-full text-left text-sm px-3 py-2 hover:bg-gray-50 rounded" onClick={() => openEdit(d.id, d.title)}>✏️ Cím szerkesztése</button>
                    <button type="button" className="w-full text-left text-sm px-3 py-2 hover:bg-gray-50 rounded" onClick={() => toggleDocVisibility(d)}>
                      ⚠️ {d.doc_visibility === "public" ? "Átváltás privátra" : "Átváltás publikussá"}
                    </button>
                    <button type="button" className="w-full text-left text-sm px-3 py-2 hover:bg-red-50 text-red-600 rounded" onClick={() => deleteDoc(d.id)}>🗑️ Törlés</button>
                  </MiniMenu>
                )}
              </>
            )}
          </article>
        );
      })}
    </div>
  );
}

function ExpensesSection(props: any) {
  const {
    isOwner, id, msgExp, setMsgExp, expenses,
    openMenuId, setOpenMenuId,
    editExpId, editExp, setEditExp,
    openEditExp, closeEditExp, saveExpense, deleteExpense,
  } = props;

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
      await fetch(`/api/expenses/list?trip_id=${id}`, { cache: "no-store" });
      location.reload();
    } else {
      setMsgExp("Hiba ❌ " + (j?.error || r.status));
    }
  }

  return (
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
        {expenses.map((ex: any) => {
          const isEditing = editExpId === ex.id;
          return (
            <li key={ex.id} className="relative border rounded px-3 py-2 bg-white">
              {isEditing ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  <input type="date" value={editExp.date || ""} onChange={(e) => setEditExp((s: any) => ({ ...s, date: e.target.value }))} className="border rounded px-2 py-1" />
                  <input value={editExp.category || ""} onChange={(e) => setEditExp((s: any) => ({ ...s, category: e.target.value }))} placeholder="Kategória" className="border rounded px-2 py-1" />
                  <input value={editExp.description || ""} onChange={(e) => setEditExp((s: any) => ({ ...s, description: e.target.value }))} placeholder="Megjegyzés" className="border rounded px-2 py-1 sm:col-span-2" />
                  <input type="number" step="0.01" value={Number(editExp.amount ?? 0)} onChange={(e) => setEditExp((s: any) => ({ ...s, amount: Number(e.target.value) }))} placeholder="Összeg" className="border rounded px-2 py-1" />
                  <input value={editExp.currency || ""} onChange={(e) => setEditExp((s: any) => ({ ...s, currency: e.target.value }))} placeholder="Pénznem" className="border rounded px-2 py-1" />
                  <input value={editExp.payment_method || ""} onChange={(e) => setEditExp((s: any) => ({ ...s, payment_method: e.target.value }))} placeholder="Fizetési mód" className="border rounded px-2 py-1" />
                  <div className="flex items-center gap-2 sm:col-span-2">
                    <button type="button" onClick={saveExpense} className="border rounded px-3 py-1">Mentés</button>
                    <button type="button" onClick={closeEditExp} className="text-gray-600">Mégse</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="font-medium">
                    {ex.date} • {ex.category} • {ex.amount} {ex.currency}
                  </div>
                  <div className="text-xs text-gray-600">
                    {ex.description} • Fizetés: {ex.payment_method}
                  </div>
                </>
              )}

              {!isEditing && (
                <>
                  <button
                    type="button"
                    onClick={() => setOpenMenuId(openMenuId === ex.id ? null : ex.id)}
                    className="absolute top-2 right-2 rounded-full p-1.5 bg-white/90 hover:bg-white shadow border"
                    aria-label="Műveletek"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" className="opacity-80">
                      <circle cx="5" cy="12" r="1.8"></circle>
                      <circle cx="12" cy="12" r="1.8"></circle>
                      <circle cx="19" cy="12" r="1.8"></circle>
                    </svg>
                  </button>
                  {openMenuId === ex.id && (
                    <div className="absolute top-10 right-2 z-10 bg-white border rounded-lg shadow-lg min-w-[160px]">
                      <div className="p-1">
                        <button
                          type="button"
                          className="w-full text-left text-sm px-3 py-2 hover:bg-gray-50 rounded"
                          onClick={() => { setOpenMenuId(null); openEditExp(ex); }}
                        >
                          ✏️ Szerkesztés
                        </button>
                        <button type="button" className="w-full text-left text-sm px-3 py-2 hover:bg-red-50 text-red-600 rounded" onClick={() => deleteExpense(ex.id)}>
                          🗑️ Törlés
                        </button>
                      </div>
                      <button type="button" onClick={() => setOpenMenuId(null)} className="w-full text-xs text-gray-500 py-1 hover:bg-gray-50 border-t">
                        Bezár
                      </button>
                    </div>
                  )}
                </>
              )}
            </li>
          );
        })}
        {expenses.length === 0 && <em className="text-gray-600">Még nincs költés.</em>}
      </ul>
    </section>
  );
}
