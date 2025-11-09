"use client";

import { useEffect, useMemo, useState } from "react";

export type ViewerModalProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  mime?: string;
  driveFileId: string;
  // opcionális plusz fallbackok
  mediaId?: string;          // belső azonosító (photo/doc ID)
  proxyPath?: string;        // pl. "/api/photos/file/ID" vagy "/api/documents/file/ID"
};

function buildImageUrl(driveId: string) {
  const id = encodeURIComponent(driveId);
  return `https://drive.google.com/uc?export=view&id=${id}`;
}

function buildPdfChain(driveId: string, proxyPath?: string) {
  const id = encodeURIComponent(driveId);
  const downloadUrl = `https://drive.google.com/uc?id=${id}&export=download`;
  // 1) Google Docs Viewer (HTML alapú, PWA-ban stabil)
  const gview = `https://docs.google.com/gview?embedded=1&url=${encodeURIComponent(downloadUrl)}`;
  // 2) Drive preview
  const preview = `https://drive.google.com/file/d/${id}/preview`;
  // 3) Saját stream (PWA-barát)
  const mine = proxyPath || "";
  return [gview, preview, mine].filter(Boolean);
}

export default function ViewerModal(props: ViewerModalProps) {
  const { open, onClose, title, mime, driveFileId, proxyPath } = props;

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

  const [pdfStep, setPdfStep] = useState(0);
  useEffect(() => {
    // modal nyitásakor mindig 0. lépésről indulunk
    if (open) setPdfStep(0);
  }, [open]);

  const imageUrl = useMemo(() => buildImageUrl(driveFileId), [driveFileId]);
  const pdfUrls = useMemo(() => buildPdfChain(driveFileId, proxyPath), [driveFileId, proxyPath]);
  const pdfSrc = pdfUrls[pdfStep] || "";

  const isImage = !!mime?.startsWith("image/");
  const isPdf = mime === "application/pdf";

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
          <div className="font-medium truncate">
            {title || (isImage ? "Kép" : isPdf ? "PDF" : "Dokumentum")}
          </div>
          <button onClick={onClose} className="text-sm px-3 py-1 border rounded-md hover:bg-gray-50">
            Bezárás
          </button>
        </div>

        <div className="bg-black/5">
          {isImage ? (
            <div className="w-full grid place-items-center">
              <img
                src={imageUrl}
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
                  // 2) végső fallback: download URL (sok böngésző képként is kirajzolja)
                  if (img.dataset.step !== "download") {
                    img.dataset.step = "download";
                    img.src = `https://drive.google.com/uc?id=${encodeURIComponent(driveFileId)}&export=download`;
                  }
                }}
              />
            </div>
          ) : isPdf ? (
            <iframe
              key={pdfSrc} // hogy onError után tényleg újratöltse a következő URL-t
              src={pdfSrc}
              title={title || "PDF"}
              className="w-full"
              style={{ height: "85vh", border: 0 }}
              allow="autoplay; fullscreen"
              onError={() => {
                // próbáljuk a következő forrást
                if (pdfStep < pdfUrls.length - 1) setPdfStep(pdfStep + 1);
              }}
            />
          ) : (
            // egyéb doksi – megpróbáljuk a saját streamet iframe-be
            <iframe
              src={proxyPath || ""}
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
