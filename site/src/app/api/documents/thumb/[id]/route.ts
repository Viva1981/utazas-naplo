import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sheetsGet } from "@/lib/sheets";

const TRIPS_RANGE = "Trips!A2:I";
const DOCS_RANGE  = "Documents!A2:M";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

async function loadByDocId(docId: string) {
  const dRes = await sheetsGet(DOCS_RANGE);
  const dRows = dRes.values ?? [];
  const r = dRows.find((x: any[]) => String(x?.[0] ?? "").trim() === docId);
  if (!r) return { trip: null as any, doc: null as any };

  const doc = {
    id: String(r?.[0] ?? ""),
    trip_id: String(r?.[1] ?? ""),
    title: String(r?.[2] ?? ""),
    drive_file_id: String(r?.[3] ?? ""),
    mimeType: String(r?.[4] ?? ""),
    thumbnailLink: String(r?.[7] ?? ""),
    uploader_user_id: String(r?.[10] ?? ""),
    archived_at: String(r?.[11] ?? ""),
    doc_visibility: (String(r?.[12] ?? "private").toLowerCase() === "public" ? "public" : "private") as "public" | "private",
  };

  const tRes = await sheetsGet(TRIPS_RANGE);
  const tRows = tRes.values ?? [];
  const t = tRows.find((x: any[]) => String(x?.[0] ?? "").trim() === doc.trip_id);
  if (!t) return { trip: null as any, doc };

  const trip = {
    id: String(t?.[0] ?? ""),
    owner_user_id: String(t?.[5] ?? "").toLowerCase(),
    visibility: (String(t?.[8] ?? "").trim().toLowerCase() === "public" ? "public" : "private") as "public" | "private",
  };

  return { trip, doc };
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id?: string }> }
) {
  try {
    const p = await ctx.params;
    const id = (p?.id ?? "").trim();
    if (!id) return new Response("Missing id", { status: 400 });

    const session: any = await getServerSession(authOptions);
    const viewerEmail = (session?.user?.email || "").toLowerCase();
    const accessToken: string = session?.accessToken || "";

    const { trip, doc } = await loadByDocId(id);
    if (!doc || !trip) return new Response("Not found", { status: 404 });
    if (doc.archived_at) return new Response("Not found", { status: 404 });

    const isOwner = !!viewerEmail && viewerEmail === trip.owner_user_id;

    if (trip.visibility === "private" && !isOwner) return new Response("Not found", { status: 404 });
    if (trip.visibility === "public" && doc.doc_visibility !== "public" && !isOwner) return new Response("Not found", { status: 404 });

    // thumb próbálkozás
    if (doc.thumbnailLink) {
      const r = await fetch(doc.thumbnailLink, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (r.ok) {
        const headers = new Headers();
        headers.set("Content-Type", "image/jpeg");
        if (trip.visibility === "public" && doc.doc_visibility === "public") {
          headers.set("Cache-Control", "public, max-age=3600, s-maxage=3600");
        } else {
          headers.set("Cache-Control", "no-store");
        }
        return new Response(r.body, { status: 200, headers });
      }
    }

    // fallback: teljes fájl
    if (!accessToken) return new Response("Unauthorized", { status: 401 });
    const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(doc.drive_file_id)}?alt=media`;
    const r2 = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!r2.ok) {
      const txt = await r2.text().catch(() => "");
      return new Response(`Drive fetch error: ${r2.status} ${txt}`, { status: 502 });
    }

    const headers = new Headers();
    headers.set("Content-Type", doc.mimeType?.startsWith("image/") ? doc.mimeType : "image/jpeg");
    if (trip.visibility === "public" && doc.doc_visibility === "public") {
      headers.set("Cache-Control", "public, max-age=3600, s-maxage=3600");
    } else {
      headers.set("Cache-Control", "no-store");
    }
    return new Response(r2.body, { status: 200, headers });
  } catch (e: any) {
    console.error("/api/documents/thumb/[id] error:", e?.message || e);
    return new Response("Internal error", { status: 500 });
  }
}
