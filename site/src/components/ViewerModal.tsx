"use client";

import { useEffect } from "react";

export type ViewerModalProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  mime?: string;
  driveFileId: string;
  // opcionális plusz fallbackok
  mediaId?: string;          // belső azonosító (photo/doc ID), ha van saját proxy
  proxyPath?: string;        // pl. "/api/photos/file/ID" vagy "/api/documents/file/ID"
};

function buildInlineUrl(mime: string | undefined, driveId: string) {
  const id = encodeURIComponent(driveId);
  if (mime?.startsWith("image/")) return `https://drive.google.com/uc?export=view&id=${id}`;
  if (mime === "application/pdf") return `https://drive.google.com/file/d/${id}/preview`;
  return `https://drive.google.com/file/d/${id}/view`;
}

export default function ViewerModal(props: ViewerModalProps) {
  const { open, onClose, title, mime, driveFileId, mediaId, proxyPath } = props;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.documentElement.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  const inlineUrl = buildInlineUrl(mime, driveFileId);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-white max-w-5xl w-full rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-3 py-2 flex items-center justify-between border-b">
          <div className="font-medium truncate">{title || (mime?.startsWith("image/") ? "Kép" : "Dokumentum")}</div>
          <button onClick={onClose} className="text-sm px-3 py-1 border rounded-md hover:bg-gray-50">
            Bezárás
          </button>
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
                  // 1) próbáld a saját proxyt (ha van)
                  if (!img.dataset.step && proxyPath) {
                    img.dataset.step = "proxy";
                    img.src = proxyPath;
                    return;
                  }
                  // 2) végső fallback: download URL — a legtöbb böngésző ezt is megjeleníti
                  if (img.dataset.step !== "download") {
                    img.dataset.step = "download";
                    img.src = `https://drive.google.com/uc?id=${encodeURIComponent(driveFileId)}&export=download`;
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
