import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sheetsGet } from "@/lib/sheets";

const TRIPS_RANGE = "Trips!A2:I";
const MEDIA_RANGE = "Media!A2:O";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

async function getTripAndMedia(mediaId: string) {
  const mRes = await sheetsGet(MEDIA_RANGE);
  const mRows = mRes.values ?? [];
  const m = mRows.find((r: any[]) => String(r?.[0] ?? "").trim() === mediaId);
  if (!m) return { trip: null as any, media: null as any };

  const media = {
    id: String(m?.[0] ?? ""),
    trip_id: String(m?.[1] ?? ""),
    mimeType: String(m?.[5] ?? ""),
    drive_file_id: String(m?.[4] ?? ""),
    uploader_user_id: String(m?.[11] ?? ""),
    archived_at: String(m?.[12] ?? ""),
    media_visibility: (String(m?.[14] ?? "private").toLowerCase() === "public" ? "public" : "private") as "public" | "private",
  };

  const tRes = await sheetsGet(TRIPS_RANGE);
  const tRows = tRes.values ?? [];
  const t = tRows.find((r: any[]) => String(r?.[0] ?? "").trim() === media.trip_id);
  if (!t) return { trip: null as any, media };

  const trip = {
    id: String(t?.[0] ?? ""),
    owner_user_id: String(t?.[5] ?? "").toLowerCase(),
    visibility: (String(t?.[8] ?? "").trim().toLowerCase() === "public" ? "public" : "private") as "public" | "private",
  };

  return { trip, media };
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

    const { trip, media } = await getTripAndMedia(id);
    if (!media || !trip) return new Response("Not found", { status: 404 });
    if (media.archived_at) return new Response("Not found", { status: 404 }); // archivált nem elérhető

    const isOwner = !!viewerEmail && viewerEmail === trip.owner_user_id;
    const isUploader = !!viewerEmail && viewerEmail === (media.uploader_user_id || "").toLowerCase();

    // trip-láthatóság
    if (trip.visibility === "private" && !isOwner) {
      return new Response("Not found", { status: 404 });
    }

    // media-láthatóság
    if (media.media_visibility === "private" && !(isOwner || isUploader)) {
      return new Response("Not found", { status: 404 });
    }

    if (!accessToken) return new Response("Unauthorized", { status: 401 });

    // Drive letöltés
    const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(media.drive_file_id)}?alt=media`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!r.ok) {
      const txt = await r.text().catch(() => "");
      return new Response(`Drive fetch error: ${r.status} ${txt}`, { status: 502 });
    }

    const headers = new Headers();
    headers.set("Content-Type", media.mimeType || "application/octet-stream");
    // cache: public lehet hosszabb; private legyen rövidebb
    if (media.media_visibility === "public" && trip.visibility === "public") {
      headers.set("Cache-Control", "public, max-age=3600, s-maxage=3600");
    } else {
      headers.set("Cache-Control", "no-store");
    }
    return new Response(r.body, { status: 200, headers });
  } catch (e: any) {
    console.error("/api/media/file/[id] error:", e?.message || e);
    return new Response("Internal error", { status: 500 });
  }
}
