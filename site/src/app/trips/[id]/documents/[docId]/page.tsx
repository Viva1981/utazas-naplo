"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import ViewerModal from "@/components/ViewerModal";

type Doc = {
  id: string;
  trip_id: string;
  title?: string;
  drive_file_id: string;
  mimeType?: string;
};

export default function DocDeepLinkPage() {
  const { id, docId } = useParams<{ id: string; docId: string }>();
  const router = useRouter();
  const [item, setItem] = useState<Doc | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const r = await fetch(`/api/documents/list?trip_id=${id}`, { cache: "no-store" });
      const arr: Doc[] = r.ok ? await r.json().catch(() => []) : [];
      const found = arr.find((d) => d.id === String(docId)) || null;
      if (alive) setItem(found);
    })();
    return () => { alive = false; };
  }, [id, docId]);

  const proxyPath = useMemo(() => {
    return item ? `/api/documents/file/${encodeURIComponent(item.id)}` : "";
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
