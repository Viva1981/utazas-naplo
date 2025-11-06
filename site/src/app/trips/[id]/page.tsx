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
  drive_folder_id?: string;
  drive_folder_link?: string;
  visibility?: "public" | "private";
};

type Media = {
  id: string;
  trip_id: string;
  title: string;
  drive_file_id: string;
  mimeType?: string;
  uploader_user_id?: string;
  archived_at?: string;
  category?: "image" | "document" | "";
  media_visibility?: "public" | "private";
};

type Expense = {
  id: string;
  trip_id: string;
  date: string; // YYYY-MM-DD
  concept: string;
  amount: number; // HUF
  who?: string; // később: enum
};

/* ======= Oldal ======= */
export default function TripPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const { data: session } = useSession();

  const [trip, setTrip] = useState<Trip | null>(null);
  const [notFound, setNotFound] = useState(false);

  const [media, setMedia] = useState<Media[]>([]);
  const [documents, setDocuments] = useState<Media[]>([]);
  const [images, setImages] = useState<Media[]>([]);
  const [uploadMsg, setUploadMsg] = useState("");

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [expenseMsg, setExpenseMsg] = useState("");

  const isOwner = useMemo(() => {
    const email = session?.user?.email || "";
    return !!trip?.owner_user_id && trip.owner_user_id === email;
  }, [trip, session?.user?.email]);

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

      // Media lista
      const r2 = await fetch(`/api/media/list?trip_id=${encodeURIComponent(String(id))}`, {
        cache: "no-store",
      });
      if (!alive) return;
      if (r2.ok) {
        const list: Media[] = await r2.json().catch(() => []);
        setMedia(list);

        const imgs = list.filter(
          (m) =>
            m.category === "image" ||
            (m.mimeType || "").toLowerCase().startsWith("image/")
        );
        setImages(imgs);

        const docs = list.filter(
          (m) => m.category === "document" || !(m.mimeType || "").toLowerCase().startsWith("image/")
        );
        setDocuments(docs);
      }

      // Költések lista
      const r3 = await fetch(`/api/expenses/list?trip_id=${encodeURIComponent(String(id))}`, {
        cache: "no-store",
      });
      if (!alive) return;
      if (r3.ok) {
        const list: Expense[] = await r3.json().catch(() => []);
        setExpenses(list);
      }
    })();

    return () => {
      alive = false;
    };
  }, [id]);

  if (notFound) {
    return (
      <main className="max-w-4xl mx-auto px-4 py-10">
        <p>Ez az út nem található.</p>
      </main>
    );
  }

  if (!trip) {
    return (
      <main className="max-w-4xl mx-auto px-4 py-10">
        <p>Betöltés…</p>
      </main>
    );
  }

  /* ======= Láthatóság váltás ======= */
  async function onChangeVisibility(next: "public" | "private") {
    if (!trip) return;
    const r = await fetch(`/api/trips/visibility/${encodeURIComponent(trip.id)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visibility: next }),
    });
    if (r.ok) {
      setTrip({ ...trip, visibility: next });
    }
  }

  /* ======= Dokumentum feltöltés ======= */
  async function onUploadDocs(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setUploadMsg("");
    if (!trip) {
      setUploadMsg("Hiba: az utazás még nem töltődött be.");
      return;
    }
    const fd = new FormData(e.currentTarget);

    const r = await fetch(`/api/media/upload?trip_id=${encodeURIComponent(trip.id)}`, {
      method: "POST",
      body: fd,
    });
    if (!r.ok) {
      const txt = await r.text().catch(() => "");
      setUploadMsg(`Hiba: ${txt || r.status}`);
      return;
    }
    setUploadMsg("Siker ✅");

    // frissítsük a listát
    const r2 = await fetch(`/api/media/list?trip_id=${encodeURIComponent(trip.id)}`, {
      cache: "no-store",
    });
    if (r2.ok) {
      const list: Media[] = await r2.json().catch(() => []);
      setMedia(list);
      const imgs = list.filter(
        (m) =>
          m.category === "image" ||
          (m.mimeType || "").toLowerCase().startsWith("image/")
      );
      setImages(imgs);
      const docs = list.filter(
        (m) => m.category === "document" || !(m.mimeType || "").toLowerCase().startsWith("image/")
      );
      setDocuments(docs);
    }
    (e.currentTarget as HTMLFormElement).reset();
  }

  /* ======= Média törlés ======= */
  async function onDeleteMedia(mediaId: string) {
    if (!confirm("Biztosan törlöd a dokumentumot?")) return;
    const r = await fetch(`/api/media/${encodeURIComponent(mediaId)}`, { method: "DELETE" });
    if (r.ok) {
      setMedia((prev) => prev.filter((m) => m.id !== mediaId));
      setImages((prev) => prev.filter((m) => m.id !== mediaId));
      setDocuments((prev) => prev.filter((m) => m.id !== mediaId));
    }
  }

  /* ======= Költés hozzáadás ======= */
  async function onExpense(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setExpenseMsg("");
    if (!trip) {
      setExpenseMsg("Hiba: az utazás még nem töltődött be.");
      return;
    }
    const fd = new FormData(e.currentTarget);

    const payload = {
      trip_id: trip.id,
      date: String(fd.get("date") || ""),
      concept: String(fd.get("concept") || ""),
      amount: Number(fd.get("amount") || 0),
      who: String(fd.get("who") || ""),
    };

    const r = await fetch(`/api/expenses/add`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!r.ok) {
      const t = await r.text().catch(() => "");
      setExpenseMsg(`Hiba: ${t || r.status}`);
      return;
    }

    setExpenseMsg("Siker ✅");
    // frissítés
    const r2 = await fetch(`/api/expenses/list?trip_id=${encodeURIComponent(trip.id)}`, {
      cache: "no-store",
    });
    if (r2.ok) {
      const list: Expense[] = await r2.json().catch(() => []);
      setExpenses(list);
    }
    (e.currentTarget as HTMLFormElement).reset();
  }

  return (
    <main className="px-4 py-8">
      {/* Hero */}
      <section className="relative">
        <div className="max-w-5xl mx-auto bg-white/80 backdrop-blur-md rounded-xl shadow p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-semibold text-gray-900">{trip.title}</h1>
              <p className="text-gray-700 mt-1">
                {trip.destination || "—"} • {trip.start_date || "?"} → {trip.end_date || "?"}
              </p>
              {trip.drive_folder_link && (
                <p className="mt-2">
                  <a
                    className="text-sm underline"
                    href={trip.drive_folder_link}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Google Drive mappa megnyitása
                  </a>
                </p>
              )}
            </div>

            {/* Láthatóság */}
            {isOwner && (
              <div className="text-right">
                <label className="block text-sm text-gray-700 mb-1">Láthatóság</label>
                <select
                  className="border rounded-md px-2 py-1"
                  value={trip.visibility || "public"}
                  onChange={(e) => onChangeVisibility(e.target.value as any)}
                >
                  <option value="private">Privát</option>
                  <option value="public">Publikus</option>
                </select>
                <div className="text-xs text-gray-500 mt-1">
                  {trip.visibility === "public" ? "🌍 Látható mindenkinek" : "🔒 Csak neked"}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Képek */}
      {images.length > 0 && (
        <section className="max-w-5xl mx-auto mt-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-3">Képek</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {images.map((m) => {
              const thumb = `/api/media/thumb/${encodeURIComponent(m.id)}`;
              const full = `/api/media/file/${encodeURIComponent(m.id)}`;
              return (
                <a
                  key={m.id}
                  className="block border rounded-lg overflow-hidden"
                  href={full}
                  target="_blank"
                  rel="noreferrer"
                >
                  <img src={thumb} alt={m.title || m.mimeType || "kép"} className="w-full h-auto" />
                </a>
              );
            })}
          </div>
        </section>
      )}

      {/* 📂 Dokumentumok */}
      <TripDocuments
        documents={documents}
        isOwner={isOwner}
        onUploadDocs={onUploadDocs}
        onDeleteMedia={onDeleteMedia}
        uploadMsg={uploadMsg}
      />

      {/* 💳 Költések */}
      <section className="max-w-5xl mx-auto mt-10 p-6 bg-white/80 backdrop-blur-md rounded-xl shadow-md">
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">Költések</h2>

        {isOwner ? (
          <>
            <form onSubmit={onExpense} className="grid gap-3 md:grid-cols-2">
              <input type="date" name="date" required className="border rounded-md px-3 py-2" />
              <input
                name="concept"
                placeholder="Megnevezés"
                required
                className="border rounded-md px-3 py-2"
              />
              <input
                name="amount"
                type="number"
                min={0}
                step="1"
                placeholder="Összeg (HUF)"
                required
                className="border rounded-md px-3 py-2"
              />
              <input
                name="who"
                placeholder="Ki fizette?"
                className="border rounded-md px-3 py-2"
              />
              <button className="border rounded-md px-4 py-2">Hozzáadás</button>
            </form>
            {expenseMsg && <p className="text-sm mt-2">{expenseMsg}</p>}
          </>
        ) : (
          <p className="text-sm text-gray-600">Csak a tulajdonos adhat hozzá költést.</p>
        )}

        {expenses.length > 0 && (
          <div className="mt-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-600 border-b">
                  <th className="py-2 pr-3">Dátum</th>
                  <th className="py-2 pr-3">Megnevezés</th>
                  <th className="py-2 pr-3">Összeg (HUF)</th>
                  <th className="py-2">Ki</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((e) => (
                  <tr key={e.id} className="border-b last:border-b-0">
                    <td className="py-2 pr-3">{e.date}</td>
                    <td className="py-2 pr-3">{e.concept}</td>
                    <td className="py-2 pr-3">{e.amount.toLocaleString("hu-HU")}</td>
                    <td className="py-2">{e.who || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
