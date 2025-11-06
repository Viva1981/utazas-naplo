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
};

type Props = {
  documents: Media[];
  isOwner: boolean;
  onUploadDocs: (e: React.FormEvent<HTMLFormElement>) => void;
  onDeleteMedia: (id: string) => void;
  uploadMsg?: string;
}

export default function TripDocuments({
  documents,
  isOwner,
  onUploadDocs,
  onDeleteMedia,
  uploadMsg,
}: Props) {
  const hasDocs = documents.length > 0;

  return (
    <section className="max-w-5xl mx-auto mt-10 p-6 bg-white/80 backdrop-blur-md rounded-xl shadow-md">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-gray-800">Dokumentumok</h2>

        {isOwner && (
          <form onSubmit={onUploadDocs} className="flex items-center gap-2">
            <input
              type="file"
              name="files"
              multiple
              className="text-sm"
              aria-label="Dokumentumok feltöltése"
            />
            <button className="border rounded-md px-3 py-1">Feltöltés</button>
          </form>
        )}
      </div>

      {uploadMsg && <p className="text-sm mt-2">{uploadMsg}</p>}

      {!hasDocs ? (
        <p className="text-gray-600 mt-4">Még nincsenek dokumentumok.</p>
      ) : (
        <div className="grid gap-3 mt-6 md:grid-cols-2">
          {documents.map((m) => {
            const isPublic = (m.media_visibility || "public") === "public";
            const isImage = (m.category === "image") || (m.mimeType || "").toLowerCase().startsWith("image/");
            const thumb = `/api/media/thumb/${encodeURIComponent(m.id)}`;
            const full = `/api/media/file/${encodeURIComponent(m.id)}`;

            return (
              <article
                key={m.id}
                className={`group border rounded-xl shadow-sm hover:shadow-lg transition overflow-hidden ${
                  isPublic ? "bg-white" : "bg-gray-50"
                }`}
                aria-label={`Dokumentum: ${m.title || m.mimeType || "dokumentum"}`}
              >
                <div className="relative aspect-[4/3] bg-gray-100 overflow-hidden">
                  {isImage ? (
                    <img
                      src={thumb}
                      alt={m.title || m.mimeType || "dokumentum"}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-500 text-sm">
                      {m.mimeType || "Dokumentum"}
                    </div>
                  )}
                </div>

                <div className="p-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <a
                      href={full}
                      target="_blank"
                      rel="noreferrer"
                      className="block font-medium text-gray-800 truncate hover:underline"
                      title={m.title || m.drive_file_id}
                    >
                      {m.title || m.drive_file_id}
                    </a>
                    {!isPublic && (
                      <div className="text-xs text-gray-500 mt-1">🔒 Privát dokumentum</div>
                    )}
                  </div>

                  {typeof onDeleteMedia === "function" && (
                    <button
                      onClick={() => onDeleteMedia(m.id)}
                      className="mt-2 text-xs text-red-600 border border-red-300 rounded-md px-3 py-1 hover:bg-red-50 transition self-start"
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
    </section>
  );
}
