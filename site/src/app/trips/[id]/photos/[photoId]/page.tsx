"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import ViewerModal from "@/components/ViewerModal";

type Photo = {
  id: string;
  trip_id: string;
  title?: string;
  drive_file_id: string;
  mimeType?: string;
};

export default function PhotoDeepLinkPage() {
  const { id, photoId } = useParams<{ id: string; photoId: string }>();
  const router = useRouter();
  const [item, setItem] = useState<Photo | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      // listából szűrünk, így nem kell külön GET endpoint
      const r = await fetch(`/api/photos/list?trip_id=${id}`, { cache: "no-store" });
      const arr: Photo[] = r.ok ? await r.json().catch(() => []) : [];
      const found = arr.find((p) => p.id === String(photoId)) || null;
      if (alive) setItem(found);
    })();
    return () => { alive = false; };
  }, [id, photoId]);

  const proxyPath = useMemo(() => {
    return item ? `/api/photos/file/${encodeURIComponent(item.id)}` : "";
  }, [item]);

  return (
    <main className="p-4">
      <button
        onClick={() => router.push(`/trips/${id}`)}
        className="text-sm px-3 py-1 border rounded-md hover:bg-gray-50"
      >
        ← Vissza az útra
      </button>

      <ViewerModal
        open={!!item}
        onClose={() => router.push(`/trips/${id}`)}
        title={item?.title}
        mime={item?.mimeType}
        driveFileId={item?.drive_file_id || ""}
        mediaId={item?.id}
        proxyPath={proxyPath}
      />
    </main>
  );
}
