"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import TripDocuments_FORCE from "@/components/TripDocuments_FORCE";

// segédfüggvények
const looksLikeImageByName = (name?: string) =>
  !!(name && /\.(jpe?g|png|webp|gif)$/i.test(name));

const isImageByMeta = (mime?: string, title?: string) =>
  (mime || "").toLowerCase().startsWith("image/") || looksLikeImageByName(title);

// modál állapot a nagy előnézethez
const [docPreview, setDocPreview] = useState<null | {
  driveId: string;
  title?: string;
  mime?: string;
}>(null);


type Trip = {
  id: string;
  title: string;
  start_date?: string;
  end_date?: string;
  destination?: string;
  owner_user_id?: string;
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
  uploader_user_id?: string;
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

// ---- helpers ----------------------------------------------------

function fileIcon(title?: string, mimeType?: string) {
  const t = (title || "").toLowerCase();
  const mime = (mimeType || "").toLowerCase();
  if (mime.includes("pdf") || t.endsWith(".pdf")) return "📄";
  if (mime.includes("sheet") || /\.(xls|xlsx|ods)$/.test(t)) return "📊";
  if (mime.includes("word") || /\.(doc|docx|odt)$/.test(t)) return "📝";
  if (mime.startsWith("video/") || /\.(mp4|mov|mkv|webm)$/.test(t)) return "🎞️";
  if (mime.startsWith("audio/") || /\.(mp3|wav|m4a|flac)$/.test(t)) return "🎵";
  if (mime.startsWith("image/") || /\.(png|jpe?g|gif|webp|avif|heic|heif)$/i.test(t)) return "🖼️";
  return "📎";
}

function niceDate(d?: string) {
  if (!d) return "";
  const [Y, M, D] = d.split("-");
  return `${Y}.${M}.${D}`;
}

// ----------------------------------------------------------------

export default function Page() {
  const { id } = useParams<{ id: string }>();
  return <TripDetail key={id} id={String(id)} />;
}

function TripDetail({ id }: { id: string }) {
  const { data: sess } = useSession();

  const [trip, setTrip] = useState<Trip | null>(null);
  const [media, setMedia] = useState<Media[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [uploadMsg, setUploadMsg] = useState("");
  const [expMsg, setExpMsg] = useState("");
  const [notFound, setNotFound] = useState(false);

  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const isOwner =
    !!(sess?.user?.email && trip?.owner_user_id) &&
    sess.user.email.toLowerCase() === (trip!.owner_user_id as string).toLowerCase();

  useEffect(() => {
    let alive = true;

    setNotFound(false);
    setTrip(null);
    setMedia([]);
    setExpenses([]);
    setUploadMsg("");
    setExpMsg("");
    setLightboxIndex(null);

    try {
      window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    } catch {}

    (async () => {
      // TRIP
      const r = await fetch(`/api/trips/get/${id}`, { cache: "no-store" });
      if (!alive) return;
      if (!r.ok) {
        console.error("Trip fetch failed:", await r.text());
        setNotFound(true);
        return;
      }
      const t: Trip = await r.json().catch(() => null as any);
      if (!alive) return;
      setTrip(t);

      // MEDIA – szerver már szűri láthatóság szerint
      const m = await fetch(`/api/media/list?trip_id=${id}`, { cache: "no-store" })
        .then((x) => x.json())
        .catch(() => ({ items: [] }));
      if (!alive) return;
      setMedia((m.items || []) as Media[]);

      // EXPENSES
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

  /* ======= Képek / Dokumentumok leválogatás (category elsőbbség) ======= */
const looksLikeImageByName = (name?: string) =>
  !!(name && /\.(jpe?g|png|webp|gif)$/i.test(name));

const isImageLike = (m: any) =>
  (m.category === "image") ||
  ((m.category == null || m.category === "") &&
    (String(m.mimeType || "").toLowerCase().startsWith("image/") || looksLikeImageByName(m.title)));

const images = useMemo(
  () => media.filter((m) => !m.archived_at && isImageLike(m)),
  [media]
);

const documents = useMemo(
  () => media.filter((m) => !m.archived_at && !isImageLike(m)),
  [media]
);
/* ======= /Képek / Dokumentumok leválogatás ======= */

  // --- Upload (max 3 kép a „Fotók”-hoz) -------------------------------------
  const imageCount = images.length;
  const remainingImageSlots = Math.max(0, 3 - imageCount);

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

    const r = await fetch("/api/drive/upload", {
      method: "POST",
      body: fd,
      credentials: "include",
    });

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

    const form = e.currentTarget as HTMLFormElement;
    const fileInput = form.querySelector('input[name="file"]') as HTMLInputElement | null;
    const selectedCount = fileInput?.files?.length || 0;

    if (selectedCount === 0) {
      setUploadMsg("Válassz legalább egy fájlt a dokumentumokhoz.");
      return;
    }

    setUploadMsg("Feltöltés…");

    const fd = new FormData(form);
    fd.append("tripId", String(id));
    fd.append("type", "file");
    fd.append("category", "document");
    if (!fd.get("media_visibility")) fd.set("media_visibility", "private");

    const r = await fetch("/api/drive/upload", {
      method: "POST",
      body: fd,
      credentials: "include",
    });

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
    const r = await fetch(`/api/media/${mid}`, {
      method: "DELETE",
      credentials: "include",
    });
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

  async function onExpense(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;

    setExpMsg("Mentés…");
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
      const e2 = await fetch(`/api/expenses/list?trip_id=${id}`, { cache: "no-store" }).then(
        (x) => x.json()
      );
      setExpenses(e2.items || []);
      (form as HTMLFormElement).reset();
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

        {/* Láthatóság kapcsoló – csak tulajdonosnak */}
        {isOwner && (
          <div style={{ marginTop: 8 }}>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              Láthatóság:
              <select
                value={trip.visibility || "private"}
                onChange={(e) => onChangeVisibility(e.target.value as "public" | "private")}
              >
                <option value="private">Privát</option>
                <option value="public">Publikus</option>
              </select>
            </label>
            <span style={{ marginLeft: 12, fontSize: 12, color: "#666" }}>
              Jelenleg: <b>{(trip.visibility || "private") === "public" ? "Publikus" : "Privát"}</b>
            </span>
          </div>
        )}
      </section>

      {/* FOTÓK (max 3 + lightbox) */}
      <section style={{ border: "1px solid #eee", borderRadius: 8, padding: 12, display: "grid", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
          <h2 style={{ margin: 0 }}>Fotók</h2>
          {isOwner && (
            <small style={{ color: remainingImageSlots === 0 ? "#d33" : "#666" }}>
              {remainingImageSlots === 0
                ? "Elérted a 3 képes limitet"
                : `Még ${remainingImageSlots} kép tölthető fel`}
            </small>
          )}
        </div>

        {isOwner && (
          <>
            <form onSubmit={onUploadImages} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <input
                type="file"
                name="file"
                accept="image/*"
                multiple
                required
                disabled={remainingImageSlots === 0}
              />
              <input type="text" name="title" placeholder="Cím (opcionális)" />
              <input type="hidden" name="type" value="file" />
              <input type="hidden" name="category" value="image" />
              <input type="hidden" name="media_visibility" value="public" />
              <button
                disabled={remainingImageSlots === 0}
                style={{
                  padding: 8,
                  border: "1px solid #ddd",
                  borderRadius: 6,
                  opacity: remainingImageSlots === 0 ? 0.6 : 1,
                  cursor: remainingImageSlots === 0 ? "not-allowed" : "pointer",
                }}
              >
                Feltöltés
              </button>
            </form>
            <p style={{ margin: 0 }}>{uploadMsg}</p>
          </>
        )}

        {images.length === 0 ? (
          <em style={{ color: "#666" }}>Még nincs kép.</em>
        ) : (
          <div
            style={{
              display: "grid",
              gap: 8,
              gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
            }}
          >
            {images.map((m, i) => {
              const thumb = `/api/media/thumb/${m.drive_file_id}?w=1600`;
              const canDelete =
                (!!m.uploader_user_id &&
                  !!sess?.user?.email &&
                  m.uploader_user_id.toLowerCase() === sess.user.email.toLowerCase()) ||
                isOwner;
              return (
                <div key={m.id} style={{ display: "grid", gap: 6 }}>
                  {/* ratio wrapper (4:3) – mobilbarát */}
                  <button
                    onClick={() => setLightboxIndex(i)}
                    title={m.title || "Kép megnyitása"}
                    style={{
                      border: "none",
                      padding: 0,
                      background: "transparent",
                      cursor: "zoom-in",
                      display: "block",
                      width: "100%",
                    }}
                  >
                    <div
                      style={{
                        position: "relative",
                        width: "100%",
                        paddingTop: "75%",
                        background: "#f7f7f7",
                        borderRadius: 8,
                        overflow: "hidden",
                      }}
                    >
                      <img
                        src={thumb}
                        alt={m.title || "kép"}
                        loading="lazy"
                        style={{
                          position: "absolute",
                          inset: 0,
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                          display: "block",
                        }}
                        onError={(ev) => {
                          const img = ev.currentTarget as HTMLImageElement;
                          if (!img.dataset.fallback) {
                            img.dataset.fallback = "1";
                            img.src = `https://drive.google.com/uc?export=view&id=${m.drive_file_id}`;
                          }
                        }}
                      />
                    </div>
                  </button>

                  {canDelete && (
                    <button
                      onClick={() => onDeleteMedia(m.id)}
                      style={{
                        padding: "6px 10px",
                        border: "1px solid #e33",
                        borderRadius: 6,
                        background: "#fff",
                        color: "#e33",
                        cursor: "pointer",
                        justifySelf: "start",
                      }}
                    >
                      Törlés
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Lightbox */}
        {lightboxIndex !== null && images[lightboxIndex] && (
          <dialog open style={{ border: "none", padding: 0, background: "transparent" }}>
            <div
              onClick={() => setLightboxIndex(null)}
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,.85)",
                display: "grid",
                placeItems: "center",
                cursor: "zoom-out",
              }}
            >
              <img
                src={`/api/media/thumb/${images[lightboxIndex].drive_file_id}?w=2400`}
                alt={images[lightboxIndex].title || ""}
                style={{ maxWidth: "92vw", maxHeight: "90vh", objectFit: "contain" }}
                onError={(ev) => {
                  const img = ev.currentTarget as HTMLImageElement;
                  if (!img.dataset.fallback) {
                    img.dataset.fallback = "1";
                    img.src = `https://drive.google.com/uc?export=view&id=${images[lightboxIndex].drive_file_id}`;
                  }
                }}
              />
            </div>
          </dialog>
        )}
      </section>

      {/* DOKUMENTUMOK – kártyanézet + modál előnézet */}
<section style={{ border: "1px solid #eee", borderRadius: 8, padding: 12, display: "grid", gap: 12 }}>
  <h2 style={{ margin: 0 }}>Dokumentumok</h2>

  {isOwner ? (
    <>
      <form onSubmit={onUploadDocs} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <input
          type="file"
          name="file"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.ods,.txt,image/*"
          multiple
          required
        />
        <input type="text" name="title" placeholder="Cím (opcionális)" />
        <select name="media_visibility" defaultValue="private" title="Láthatóság">
          <option value="private">Privát</option>
          <option value="public">Publikus</option>
        </select>
        <input type="hidden" name="type" value="file" />
        <input type="hidden" name="category" value="document" />
        <button style={{ padding: 8, border: "1px solid #ddd", borderRadius: 6 }}>
          Feltöltés
        </button>
      </form>
      <p style={{ margin: 0 }}>{uploadMsg}</p>
    </>
  ) : (
    <em>Csak a tulajdonos tölthet fel dokumentumokat ehhez az úthoz.</em>
  )}

  {documents.length === 0 ? (
    <em style={{ color: "#666" }}>Nincs dokumentum.</em>
  ) : (
    <div style={{
      display: "grid",
      gap: 12,
      gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))"
    }}>
      {documents.map((m) => {
        const mime = (m.mimeType || "").toLowerCase();
        const imgLike = isImageByMeta(m.mimeType, m.title);
        // kártya előnézeti kép:
        // - képnél saját thumb proxy
        // - nem képnél: Drive thumbnailLink (ha van)
        const thumb = imgLike
          ? `/api/media/thumb/${m.drive_file_id}?w=1000`
          : (m as any).thumbnailLink
              ? (m as any).thumbnailLink.replace(/=s\d+$/i, "=s1000")
              : "";

        const canDelete =
          ((m as any).uploader_user_id &&
            (sess?.user?.email || "").toLowerCase() === String((m as any).uploader_user_id).toLowerCase()) ||
          isOwner;

        return (
          <article
            key={m.id}
            onClick={() => setDocPreview({ driveId: m.drive_file_id, title: m.title, mime: m.mimeType })}
            style={{
              cursor: "pointer",
              border: "1px solid #eee",
              borderRadius: 12,
              overflow: "hidden",
              background: m.media_visibility === "public" ? "#fff" : "#fafafa",
              boxShadow: "0 1px 3px rgba(0,0,0,.06)"
            }}
            title={m.title}
          >
            <div style={{ position: "relative", background: "#f5f5f5", aspectRatio: "4/3" }}>
              {imgLike ? (
                <img
                  src={thumb}
                  alt={m.title || "Kép"}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  onError={(ev) => {
                    const img = ev.currentTarget as HTMLImageElement;
                    if (!(img as any).dataset.fallback) {
                      (img as any).dataset.fallback = "1";
                      img.src = `https://drive.google.com/uc?export=view&id=${m.drive_file_id}`;
                    }
                  }}
                />
              ) : thumb ? (
                <img
                  src={thumb}
                  alt={m.title || "Dokumentum előnézet"}
                  style={{ width: "100%", height: "100%", objectFit: "contain", background: "#fff" }}
                />
              ) : (
                <div style={{
                  width: "100%", height: "100%",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 40
                }}>📄</div>
              )}

              {m.media_visibility === "private" && (
                <span style={{
                  position: "absolute", top: 8, right: 8,
                  background: "rgba(0,0,0,.6)", color: "#fff",
                  fontSize: 12, padding: "2px 8px", borderRadius: 999
                }}>Privát</span>
              )}
            </div>

            <div style={{ padding: 12, display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 600, fontSize: 13 }}>
                {m.title || m.mimeType || "dokumentum"}
              </div>
              {canDelete && (
                <button
                  onClick={(e) => { e.stopPropagation(); onDeleteMedia(m.id); }}
                  style={{
                    padding: "4px 8px",
                    border: "1px solid #e33",
                    borderRadius: 6,
                    background: "#fff",
                    color: "#e33",
                    cursor: "pointer",
                    fontSize: 12
                  }}
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

  {/* MODÁL – nagy előnézet (NEM letölt) */}
  {docPreview && (
    <div
      onClick={() => setDocPreview(null)}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,.7)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16, zIndex: 1000
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "relative",
          width: "min(1100px, 96vw)", height: "min(85vh, 900px)",
          background: "#fff", borderRadius: 12, overflow: "hidden",
          boxShadow: "0 10px 30px rgba(0,0,0,.35)"
        }}
      >
        <button
          onClick={() => setDocPreview(null)}
          style={{
            position: "absolute", top: 8, right: 8, zIndex: 2,
            background: "rgba(0,0,0,.6)", color: "#fff",
            borderRadius: 999, padding: "6px 10px", border: 0, cursor: "pointer"
          }}
        >
          Bezárás ✕
        </button>

        {isImageByMeta(docPreview.mime, docPreview.title) ? (
          <img
            src={`/api/media/file/${docPreview.driveId}`}
            alt={docPreview.title || "Kép"}
            style={{ width: "100%", height: "100%", objectFit: "contain", background: "#000" }}
          />
        ) : (
          <iframe
            src={`https://drive.google.com/file/d/${docPreview.driveId}/preview`}
            title={docPreview.title || "Előnézet"}
            allow="autoplay"
            style={{ width: "100%", height: "100%", border: 0, background: "#fff" }}
          />
        )}
      </div>
    </div>
  )}
</section>

      {/* KÖLTÉSEK */}
      <section style={{ border: "1px solid #eee", borderRadius: 8, padding: 12 }}>
        <h2>Költés rögzítése</h2>

        {isOwner ? (
          <>
            <form onSubmit={onExpense} style={{ display: "grid", gap: 8, maxWidth: 420 }}>
              <input type="date" name="date" required />
              <input name="category" placeholder="Kategória (pl. food, transport)" defaultValue="food" />
              <input name="description" placeholder="Megjegyzés" />
              <input name="amount" type="number" step="0.01" placeholder="Összeg" required />
              <input name="currency" placeholder="Pénznem" defaultValue="HUF" />
              <input name="payment_method" placeholder="Fizetési mód" defaultValue="card" />
              <button style={{ padding: 8, border: "1px solid #ddd", borderRadius: 6 }}>Mentés</button>
            </form>
            <p>{expMsg}</p>
          </>
        ) : (
          <em>Csak a tulajdonos rögzíthet költéseket ehhez az úthoz.</em>
        )}

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
