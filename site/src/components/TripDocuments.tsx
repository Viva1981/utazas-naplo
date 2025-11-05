"use client";

import React from "react";

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
  thumbnailLink?: string;
  webViewLink?: string;
};

type Props = {
  documents: Media[];
  isOwner: boolean;
  onUploadDocs: (e: React.FormEvent<HTMLFormElement>) => void;
  onDeleteMedia: (id: string) => void;
  uploadMsg?: string;
};

const looksLikeImageByName = (name?: string) =>
  !!(name && /\.(jpe?g|png|webp|gif)$/i.test(name));

export default function TripDocuments({
  documents,
  isOwner,
  onUploadDocs,
  onDeleteMedia,
  uploadMsg,
}: Props) {
  const visibleDocs = React.useMemo(
    () =>
      isOwner
        ? documents.filter((d) => !d.archived_at)
        : documents.filter((d) => !d.archived_at && d.media_visibility === "public"),
    [documents, isOwner]
  );

  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState<Media | null>(null);
  const onOpen = (m: Media) => { setActive(m); setOpen(true); };
  const onClose = () => { setOpen(false); setTimeout(() => setActive(null), 200); };

  if (!isOwner && visibleDocs.length === 0) return null;

  return (
    <section className="max-w-5xl mx-auto mt-10 p-6 bg-white/80 backdrop-blur-md rounded-xl shadow-md">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-semibold text-gray-800">Dokumentumok</h2>
        {isOwner ? (
          <span className="text-sm text-gray-500">Privát dokumentumokat csak te látod 🔒</span>
        ) : (
          <span className="text-sm text-gray-400 italic">Csak megtekintés</span>
        )}
      </div>

      {isOwner && (
        <form
          onSubmit={onUploadDocs}
          className="flex flex-wrap gap-4 items-center border p-4 rounded-lg bg-gray-50 mb-6"
        >
          {/* FONTOS: ettől marad dokumentum még képnél is */}
          <input type="hidden" name="category" value="document" />

          <input
            type="file"
            name="file"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.ods,.txt,image/*"
            multiple
            required
            className="text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-amber-100 file:text-amber-700 hover:file:bg-amber-200"
          />
          <input
            type="text"
            name="title"
            placeholder="Cím (opcionális)"
            className="border rounded-md px-3 py-2 text-sm"
          />
          <select
            name="media_visibility"
            defaultValue="private"
            className="border rounded-md px-3 py-2 text-sm text-gray-700 bg-white shadow-sm"
            title="Láthatóság"
          >
            <option value="private">Privát</option>
            <option value="public">Publikus</option>
          </select>
          <button
            type="submit"
            className="px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-md hover:bg-amber-700 transition"
          >
            Feltöltés
          </button>
          {uploadMsg ? <span className="text-sm text-gray-500">{uploadMsg}</span> : null}
        </form>
      )}

      {visibleDocs.length === 0 ? (
        <p className="text-gray-500 italic">Nincs dokumentum feltöltve.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {visibleDocs.map((m) => {
            const mime = (m.mimeType || "").toLowerCase();
            const isImage = mime.startsWith("image/") || looksLikeImageByName(m.title);
            const isPdf = mime === "application/pdf";
            const isPublic = m.media_visibility === "public";

            const thumb = isImage
              ? `/api/media/thumb/${m.drive_file_id}?w=1000`
              : (m.thumbnailLink
                  ? m.thumbnailLink.replace(/=s\d+$/i, "=s1000")
                  : undefined);

            return (
              <article
                key={m.id}
                className={`group border rounded-xl shadow-sm hover:shadow-lg transition overflow-hidden ${isPublic ? "bg-white" : "bg-gray-50"} cursor-pointer`}
                onClick={() => onOpen(m)}
                aria-label={`Dokumentum: ${m.title || m.mimeType || "dokumentum"}`}
              >
                <div className="relative aspect-[4/3] bg-gray-100 overflow-hidden">
                  {isImage ? (
                    <img
                      src={thumb!}
                      alt={m.title || "Dokumentum kép"}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      onError={(ev) => {
                        const img = ev.currentTarget as HTMLImageElement;
                        if (!(img as any).dataset.fallback) {
                          (img as any).dataset.fallback = "1";
                          img.src = `https://drive.google.com/uc?export=view&id=${m.drive_file_id}`;
                        }
                      }}
                    />
                  ) : isPdf ? (
                    <div className="w-full h-full flex items-center justify-center bg-white text-red-600 text-xs">
                      PDF előnézet
                    </div>
                  ) : thumb ? (
                    <img
                      src={thumb}
                      alt={m.title || "Dokumentum előnézet"}
                      className="w-full h-full object-contain bg-white"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-4xl">📄</div>
                  )}

                  {!isPublic && (
                    <span className="absolute top-2 right-2 bg-black/60 text-xs text-white px-2 py-1 rounded-full">
                      Privát
                    </span>
                  )}
                </div>

                <div className="p-4 flex flex-col gap-2">
                  <h3 className="text-sm font-semibold truncate">
                    {m.title || m.mimeType || "Dokumentum"}
                  </h3>

                  {/* NINCS letöltés link – kattintás a kártyára a nagy előnézethez */}
                  {isOwner && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onDeleteMedia(m.id); }}
                      className="mt-1 text-xs text-red-600 border border-red-300 rounded-md px-3 py-1 hover:bg-red-50 transition self-start"
                      title="Dokumentum törlése"
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

      {open && active && (
        <div
          className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <div
            className="relative bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[85vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={onClose}
              className="absolute top-3 right-3 z-10 bg-black/60 text-white rounded-full px-3 py-1 text-sm"
              aria-label="Bezárás"
            >
              Bezárás ✕
            </button>

            <PreviewBody media={active} />
          </div>
        </div>
      )}
    </section>
  );
}

function PreviewBody({ media }: { media: Media }) {
  const mime = (media.mimeType || "").toLowerCase();
  const isImage = mime.startsWith("image/") || looksLikeImageByName(media.title);
  const isPdf = mime === "application/pdf";

  const drivePreview = `https://drive.google.com/file/d/${media.drive_file_id}/preview`;

  if (isImage) {
    return (
      <img
        src={`/api/media/file/${media.drive_file_id}`}
        alt={media.title || "Kép"}
        className="w-full h-full object-contain bg-black"
      />
    );
  }

  return (
    <iframe
      src={drivePreview}
      title={media.title || "Dokumentum előnézet"}
      className="w-full h-full border-0 bg-white"
      allow="autoplay"
    />
  );
}
