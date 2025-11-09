"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import ViewerModal from "@/components/ViewerModal";

type Photo = {
  id: string;
  trip_id: string;
  title?: string;
  drive_file_id: string;
  mimeType: string;
  thumbnailLink?: string;
};

export default function PhotoDeepLinkPage() {
  const { id: tripId, photoId } = useParams<{ id: string; photoId: string }>();
  const router = useRouter();

  const [photo, setPhoto] = useState<PhotoItem | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    async function run() {
      try {
        setLoading(true);
        const r = await fetch(`/api/photos/list?trip_id=${encodeURIComponent(tripId)}`, { cache: "no-store" });
        const arr: PhotoItem[] = await r.json();
        if (!alive) return;
        const one = (arr || []).find(x => x.id === photoId) || null;
        setPhoto(one);
      } catch (e) {
        console.error("photo deep link meta error:", e);
        setPhoto(null);
      } finally {
        if (alive) setLoading(false);
      }
    }
    run();
    return () => { alive = false; };
  }, [tripId, photoId]);

  const title = photo?.title || "Kép";
  const mime  = photo?.mimeType || "image/jpeg";
  const driveId = photo?.drive_file_id || "";
  const proxy = useMemo(() => `/api/photos/file/${encodeURIComponent(String(photoId))}`, [photoId]);

  const close = () => router.push(`/trips/${encodeURIComponent(String(tripId))}`);

  useEffect(() => {
    if (!loading && !photo) {
      close();
    }
  }, [loading, photo]); // eslint-disable-line

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
          mediaId={photoId}
          proxyPath={proxy}
        />
      )}
    </>
  );
}
