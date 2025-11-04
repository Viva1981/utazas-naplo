"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import TripDocuments from "@/components/TripDocuments";

/* ======= Típusok ======= */
type Trip = {
  id: string;
  title: string;
  start_date?: string;
  end_date?: string;
  destination?: string;
  owner_user_id?: string; // nálad e-mail
  visibility?: "public" | "private";
};

type Media = {
  id: string;
  trip_id: string;
  type: string;
  title: string;
  drive_file_id: string;
  webViewLink?: string;
  webContentLink?: string;
  mimeType?: string;
  thumbnailLink?: string;
  uploader_user_id?: string; // e-mail
  archived_at?: string;
  category?: "image" | "document" | "";
  media_visibility?: "public" | "private";
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

/* ======= Helper ======= */
function niceDate(d?: string) {
  if (!d) return "";
  const [Y, M, D] = d.split("-");
  return `${Y}.${M}.${D}`;
}

/* ======= Oldal ======= */
export default function Page() {
  const { id } = useParams<{ id: string }>();
  return <TripDetail key={id} id={String(id)} />;
}

function TripDetail({ id }: { id: string }) {
  const { data: sess } = useSession();

  // Alap állapotok
  const [trip, setTrip] = useState<Trip | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [heroUrl, setHeroUrl] = useState<string>("");

  // Média + költések
  const [media, setMedia] = useState<Media[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);

  // UI állapotok
  const [uploadMsg, setUploadMsg] = useState("");
  const [expMsg, setExpMsg] = useState("");
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // Tulaj?
  const isOwner =
    !!(sess?.user?.email && trip?.owner_user_id) &&
    sess.user.email.toLowerCase() === (trip!.owner_user_id as string).toLowerCase();

  /* ======= Betöltés ======= */
  useEffect(() => {
    let alive = true;

    (async () => {
      // Trip
      const r = await fetch(`/api/trips/get/${id}`, { cache: "no-store" });
      if (!alive) return;
      if (!r.ok) {
        setNotFound(true);
        return;
      }
      const t: Trip = await r.json();
      setTrip(t);

      // Hero Unsplash
      const q = encodeURIComponent(t.destination || t.title || "travel");
      setHeroUrl(`https://source.unsplash.com/1600x900/?${q}`);

      // Media
      const m = await fetch(`/api/media/list?trip_id=${id}`, { cache: "no-store" })
        .then((x) => x.json())
        .catch(() => ({ items: [] }));
      if (!alive) return;
      setMedia((m.items || []) as Media[]);

      // Expenses
      const e = await fetch(`/api/expenses/list?trip_id=${id}`, { cache: "no-store" })
        .then((x) => x.json())
        .catch(() => ({ items: [] }));
      if (!alive) return;
      setExpenses(e.items || []);
    })();

    return () => {
      alive = false;
    };
  }, [id]);

  async function refreshMedia() {
    const m = await fetch(`/api/media/list?trip_id=${id}`, { cache: "no-store" })
      .then((x) => x.json())
      .catch(() => ({ items: [] }));
    setMedia((m.items || []) as Media[]);
  }

  /* ======= Képek / Dokumentumok leválogatás ======= */
  const images = useMemo(
    () =>
      media.filter(
        (m) =>
          !m.archived_at &&
          (m.category === "image" ||
            (!m.category && (m.mimeType || "").toLowerCase().startsWith("image/")))
      ),
    [media]
  );

  const documents = useMemo(
    () =>
      media.filter(
        (m) =>
          !m.archived_at &&
          (m.category === "document" ||
            (!m.category && !(m.mimeType || "").toLowerCase().startsWith("image/")))
      ),
    [media]
  );

  /* ======= Feltöltések ======= */
  // Fotók: max 3
  const remainingImageSlots = Math.max(0, 3 - images.length);

  async function onUploadImages(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget as HTMLFormElement;
    const fileInput = form.querySelector('input[name="file"]') as HTMLInputElement | null;
    const selectedCount = fileInput?.files?.length || 0;

    if (selectedCount === 0) {
      setUploadMsg("Válassz legalább egy képfájlt.");
      return;
    }
    if (remainingImageSlots <= 0) {
      setUploadMsg("Elérted a 3 képes limitet ehhez az úthoz.");
      return;
    }
    if (selectedCount > remainingImageSlots) {
      setUploadMsg(`Legfeljebb ${remainingImageSlots} képet tölthetsz fel most.`);
      return;
    }

    setUploadMsg("Feltöltés…");
    const fd = new FormData(form);
    fd.append("tripId", String(id));
    fd.append("type", "file");
    fd.append("category", "image");
    fd.append("media_visibility", "public");

    const r = await fetch("/api/drive/upload", { method: "POST", body: fd, credentials: "include" });
    let j: any = null;
    try {
      j = await r.json();
    } catch {}
    if (r.ok) {
      setUploadMsg("Siker ✅");
      await refreshMedia();
      form.reset();
    } else {
      setUploadMsg("Hiba ❌ " + (j?.error ? String(j.error) : ""));
    }
  }

  async function onUploadDocs(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setUploadMsg("Feltöltés…");
    const form = e.currentTarget as HTMLFormElement;
    const fd = new FormData(form);
    fd.append("tripId", String(id));
    fd.append("type", "file");
    fd.append("category", "document");
    if (!fd.get("media_visibility")) fd.set("media_visibility", "private");

    const r = await fetch("/api/drive/upload", { method: "POST", body: fd, credentials: "include" });
    let j: any = null;
    try {
      j = await r.json();
    } catch {}
    if (r.ok) {
      setUploadMsg("Siker ✅");
      await refreshMedia();
      form.reset();
    } else {
      setUploadMsg("Hiba ❌ " + (j?.error ? String(j.error) : ""));
    }
  }

  async function onDeleteMedia(mid: string) {
    if (!confirm("Biztosan törlöd ezt a fájlt?")) return;
    setUploadMsg("Törlés…");
    const r = await fetch(`/api/media/${mid}`, { method: "DELETE", credentials: "include" });
    let j: any = null;
    try {
      j = await r.json();
    } catch {}
    if (r.ok) {
      setUploadMsg("Törölve ✅");
      await refreshMedia();
    } else {
      setUploadMsg("Hiba ❌ " + (j?.error ? String(j.error) : ""));
    }
  }

  /* ======= Költés rögzítés (alap) ======= */
  async function onExpense(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setExpMsg("Mentés…");
    const form = e.currentTarget as HTMLFormElement;
    const fd = new FormData(form);
    const payload = {
      trip_id: String(id),
      date: String(fd.get("date")),
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

    let j: any = null;
    try {
      j = await r.json();
    } catch {}
    if (r.ok) {
      setExpMsg("Siker ✅");
      const e2 = await fetch(`/api/expenses/list?trip_id=${id}`, { cache: "no-store" }).then((x) => x.json());
      setExpenses(e2.items || []);
      form.reset();
    } else {
      setExpMsg("Hiba ❌ " + (j?.error ? String(j.error) : ""));
    }
  }

  async function onChangeVisibility(v: "public" | "private") {
    if (!trip) return;
    const r = await fetch(`/api/trips/visibility/${trip.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visibility: v }),
      credentials: "include",
    });
    if (r.ok) {
      setTrip((t) => (t ? { ...t, visibility: v } : t));
    } else {
      alert("Nem sikerült módosítani a láthatóságot.");
    }
  }

  /* ======= Üres/Betöltés ======= */
  if (notFound)
    return (
      <main className="p-8 text-center text-gray-500">
        <h2>Nincs ilyen út</h2>
      </main>
    );
  if (!trip)
    return (
      <main className="p-8 text-center text-gray-400 animate-pulse">
        <p>Betöltés…</p>
      </main>
    );

  /* ======= Render ======= */
  return (
    <main className="min-h-screen bg-gradient-to-b from-white via-blue-50 to-white text-gray-800">
      {/* 🏔️ Hero */}
      <section className="relative h-[50vh] w-full overflow-hidden rounded-b-3xl shadow-md">
        {heroUrl && (
          <img
            src={heroUrl}
            alt={trip.destination || "Utazás"}
            className="absolute inset-0 h-full w-full object-cover brightness-90 transition-transform duration-700 hover:scale-105"
          />
        )}
        <div className="absolute inset-0 bg-black/30 flex flex-col items-center justify-center text-white text-center px-4">
          <h1 className="text-4xl md:text-6xl font-semibold drop-shadow-lg">{trip.title}</h1>
          <p className="text-lg md:text-2xl mt-3 opacity-90">{trip.destination}</p>
          <p className="text-sm mt-2 opacity-75">
            {niceDate(trip.start_date)} → {niceDate(trip.end_date)}
          </p>
        </div>
      </section>

      {/* 📸 Fotógaléria */}
      <section className="max-w-5xl mx-auto mt-10 p-6 bg-white/80 backdrop-blur-md rounded-xl shadow-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-semibold text-gray-800">Fotók</h2>
          {isOwner ? (
            <small className="text-gray-500">
              {images.length < 3 ? `Még ${3 - images.length} kép tölthető fel` : "Elérted a 3 képes limitet"}
            </small>
          ) : (
            <small className="text-gray-400 italic">Csak megtekintés</small>
          )}
        </div>

        {isOwner && (
          <form onSubmit={onUploadImages} className="flex flex-wrap gap-4 items-center border p-4 rounded-lg bg-gray-50 mb-6">
            <input
              type="file"
              name="file"
              accept="image/*"
              multiple
              required
              disabled={images.length >= 3}
              className="text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-blue-100 file:text-blue-700 hover:file:bg-blue-200"
            />
            <input type="text" name="title" placeholder="Cím (opcionális)" className="border rounded-md px-3 py-2 text-sm" />
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition disabled:opacity-50"
              disabled={images.length >= 3}
            >
              Feltöltés
            </button>
          </form>
        )}

        {images.length === 0 ? (
          <p className="text-gray-500 italic">Még nincs kép feltöltve ehhez az úthoz.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {images.map((m, i) => (
              <div key={m.id} className="group relative rounded-lg overflow-hidden shadow-sm hover:shadow-lg transition">
                <img
                  src={`/api/media/thumb/${m.drive_file_id}?w=800`}
                  alt={m.title || "Kép"}
                  className="w-full h-48 object-cover transition-transform duration-300 group-hover:scale-105 cursor-zoom-in"
                  onClick={() => setLightboxIndex(i)}
                />
                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-sm transition">
                  Kattints nagyításhoz
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Lightbox */}
        {lightboxIndex !== null && images[lightboxIndex] && (
          <dialog open className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
            <img
              src={`/api/media/thumb/${images[lightboxIndex].drive_file_id}?w=1600`}
              alt={images[lightboxIndex].title || ""}
              className="max-h-[90vh] max-w-[90vw] rounded-lg shadow-2xl"
              onClick={() => setLightboxIndex(null)}
            />
            <button onClick={() => setLightboxIndex(null)} className="absolute top-6 right-6 text-white text-3xl font-bold hover:opacity-80">
              ×
            </button>
          </dialog>
        )}
      </section>

      {/* 📂 Dokumentumok – külön komponens */}
      <TripDocuments
        documents={documents}
        isOwner={isOwner}
        onUploadDocs={onUploadDocs}
        onDeleteMedia={onDeleteMedia}
        uploadMsg={uploadMsg}
      />

      {/* 💳 Költések – (alap, majd széppé tesszük külön) */}
      <section className="max-w-5xl mx-auto mt-10 p-6 bg-white/80 backdrop-blur-md rounded-xl shadow-md">
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">Költések</h2>

        {isOwner ? (
          <>
            <form onSubmit={onExpense} className="grid gap-3 md:grid-cols-2">
              <input type="date" name="date" required className="border rounded-md px-3 py-2" />
              <input name="category" placeholder="Kategória (pl. food, transport)" defaultValue="food" className="border rounded-md px-3 py-2" />
              <input name="description" placeholder="Megjegyzés" className="border rounded-md px-3 py-2 md:col-span-2" />
              <input name="amount" type="number" step="0.01" placeholder="Összeg" required className="border rounded-md px-3 py-2" />
              <input name="currency" placeholder="Pénznem" defaultValue="HUF" className="border rounded-md px-3 py-2" />
              <input name="payment_method" placeholder="Fizetési mód" defaultValue="card" className="border rounded-md px-3 py-2" />
              <button className="px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 transition md:col-span-2">Mentés</button>
            </form>
            <p className="text-sm text-gray-500 mt-2">{expMsg}</p>
          </>
        ) : (
          <em className="text-gray-500">Csak a tulajdonos rögzíthet költéseket ehhez az úthoz.</em>
        )}

        <div className="mt-6">
          {expenses.length === 0 ? (
            <em className="text-gray-500">Még nincs költés.</em>
          ) : (
            <ul className="grid gap-3">
              {expenses.map((ex) => (
                <li key={ex.id} className="border rounded-lg p-3 bg-white flex items-center justify-between">
                  <div>
                    <div className="font-medium">
                      {ex.date} • {ex.category} • {ex.amount} {ex.currency}
                    </div>
                    <div className="text-xs text-gray-500">
                      {ex.description || "—"} • Fizetés: {ex.payment_method}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* ℹ️ Trip info + láthatóság (alsó kártya) */}
      <section className="max-w-5xl mx-auto p-6 mt-10 mb-16 bg-white/70 backdrop-blur-lg rounded-xl shadow-lg">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-2xl font-semibold mb-1">{trip.title}</h2>
            <p className="text-gray-600">
              {trip.destination} • {niceDate(trip.start_date)} → {niceDate(trip.end_date)}
            </p>
          </div>

          {isOwner && (
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                Láthatóság:
                <select
                  value={trip.visibility || "private"}
                  onChange={(e) => onChangeVisibility(e.target.value as "public" | "private")}
                  className="border rounded-md px-2 py-1 text-gray-700 bg-white shadow-sm"
                >
                  <option value="private">Privát</option>
                  <option value="public">Publikus</option>
                </select>
              </label>
              <span className="text-xs text-gray-500">
                {trip.visibility === "public" ? "🌍 Látható mindenkinek" : "🔒 Csak neked"}
              </span>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

