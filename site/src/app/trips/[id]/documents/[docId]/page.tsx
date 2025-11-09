"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import ViewerModal from "@/components/ViewerModal";

type Doc = {
  id: string;
  trip_id: string;
  title: string;
  drive_file_id: string;
  mimeType: string;
  webViewLink?: string;
  webContentLink?: string;
  thumbnailLink?: string;
  doc_visibility?: "public" | "private";
};

export default function DocDeepLinkPage() {
  const { id: tripId, docId } = useParams<{ id: string; docId: string }>();
  const router = useRouter();

  const [doc, setDoc] = useState<DocItem | null>(null);
  const [loading, setLoading] = useState(true);

  // meta lekérés kliensen — session nélkül is menjen: public visszajön
  useEffect(() => {
    let alive = true;
    async function run() {
      try {
        setLoading(true);
        const r = await fetch(`/api/documents/list?trip_id=${encodeURIComponent(tripId)}`, { cache: "no-store" });
        const arr: DocItem[] = await r.json();
        if (!alive) return;
        const one = (arr || []).find(x => x.id === docId) || null;
        setDoc(one);
      } catch (e) {
        console.error("doc deep link meta error:", e);
        setDoc(null);
      } finally {
        if (alive) setLoading(false);
      }
    }
    run();
    return () => { alive = false; };
  }, [tripId, docId]);

  const title = doc?.title || "Dokumentum";
  const mime  = doc?.mimeType || "";
  const driveId = doc?.drive_file_id || "";
  const proxy = useMemo(() => `/api/documents/file/${encodeURIComponent(String(docId))}`, [docId]);

  const close = () => router.push(`/trips/${encodeURIComponent(String(tripId))}`);

  // Minimal hibakezelés: ha nincs elem (vagy privát és nem owner),
  // akkor visszadobjuk a trip oldalra.
  useEffect(() => {
    if (!loading && !doc) {
      close();
    }
  }, [loading, doc]); // eslint-disable-line

  // Közben is megjelenítjük a modalt (üres cím/forrás esetén nem renderel)
  const canShow = !!driveId;

  return (
    <>
      {canShow && (
        <ViewerModal
          open={true}
          onClose={close}
          title={title}
          mime={mime}
          driveFileId={driveId}
          mediaId={docId}
          proxyPath={proxy}
        />
      )}
    </>
  );
}
