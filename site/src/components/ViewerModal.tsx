"use client";

import { useEffect, useMemo, useRef, useState } from "react";

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

function buildPdfChainFirstLocal(driveId: string, proxyPath?: string) {
  const id = encodeURIComponent(driveId);
  const downloadUrl = `https://drive.google.com/uc?id=${id}&export=download`;
  // 1) SAJÁT SAME-ORIGIN STREAM – ezt szereti a PWA/webview
  const local = proxyPath || "";
  // 2) Google Docs Viewer (HTML alapú, sok webview-ban stabil)
  const gview = `https://docs.google.com/gview?embedded=1&url=${encodeURIComponent(downloadUrl)}`;
  // 3) Drive preview
  const preview = `https://drive.google.com/file/d/${id}/preview`;
  return [local, gview, preview].filter(Boolean);
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
  const loadGuard = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (open) setPdfStep(0);
    return () => {
      if (loadGuard.current) clearTimeout(loadGuard.current);
      loadGuard.current = null;
    };
  }, [open]);

  const imageUrl = useMemo(() => buildImageUrl(driveFileId), [driveFileId]);
  const pdfUrls = useMemo(
    () => buildPdfChainFirstLocal(driveFileId, proxyPath),
    [driveFileId, proxyPath]
  );
  const pdfSrc = pdfUrls[pdfStep] || "";

  const isImage = !!mime?.startsWith("image/");
  const isPdf = mime === "application/pdf";

  // ha az aktuális pdfSrc „némán” blokkolódik (X-Frame-Options), nem jön onError – ezért időalapú fallback:
  const armLoadGuard = () => {
    if (loadGuard.current) clearTimeout(loadGuard.current);
    loadGuard.current = setTimeout(() => {
      if (pdfStep < pdfUrls.length - 1) {
        setPdfStep(s => s + 1);
      }
    }, 2500); // 2.5s után lépünk a következő forrásra, ha nem jött be rendesen
  };

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
          <div className="flex items-center gap-2">
            {isPdf && pdfUrls.length > 0 && (
              <a
                href={pdfUrls[0] || "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs px-2 py-1 border rounded-md hover:bg-gray-50"
                onClick={(e) => e.stopPropagation()}
                title="Megnyitás új lapon"
              >
                Megnyitás
              </a>
            )}
            <button onClick={onClose} className="text-sm px-3 py-1 border rounded-md hover:bg-gray-50">
              Bezárás
            </button>
          </div>
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
                  // 2) végső fallback: download URL
                  if (img.dataset.step !== "download") {
                    img.dataset.step = "download";
                    img.src = `https://drive.google.com/uc?id=${encodeURIComponent(driveFileId)}&export=download`;
                  }
                }}
              />
            </div>
          ) : isPdf ? (
            <iframe
              key={pdfSrc} // forrásváltáskor tényleg újratöltse
              src={pdfSrc}
              title={title || "PDF"}
              className="w-full"
              style={{ height: "85vh", border: 0 }}
              allow="autoplay; fullscreen"
              // ha tényleg betöltött, töröljük a fallback időzítőt
              onLoad={() => {
                if (loadGuard.current) {
                  clearTimeout(loadGuard.current);
                  loadGuard.current = null;
                }
              }}
              // ha hibát dob, lépjünk
              onError={() => {
                if (pdfStep < pdfUrls.length - 1) setPdfStep(s => s + 1);
              }}
              // blokkolt/néma esetekre időzített fallback
              onMouseEnter={armLoadGuard}
              onFocus={armLoadGuard}
              onLoadCapture={armLoadGuard}
            />
          ) : (
            // egyéb doksi – sajáttal próbáljuk
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
