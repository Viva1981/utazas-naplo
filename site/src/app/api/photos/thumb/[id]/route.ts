import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sheetsGet } from "@/lib/sheets";

const TRIPS_RANGE = "Trips!A2:I";
const PHOTOS_RANGE = "Photos!A2:L";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

async function loadByPhotoId(mediaId: string) {
  const pRes = await sheetsGet(PHOTOS_RANGE);
  const pRows = pRes.values ?? [];
  const r = pRows.find((x: any[]) => String(x?.[0] ?? "").trim() === mediaId);
  if (!r) return { trip: null as any, photo: null as any };

  const photo = {
    id: String(r?.[0] ?? ""),
    trip_id: String(r?.[1] ?? ""),
    title: String(r?.[2] ?? ""),
    drive_file_id: String(r?.[3] ?? ""),
    mimeType: String(r?.[4] ?? ""),
    thumbnailLink: String(r?.[7] ?? ""),
    uploader_user_id: String(r?.[10] ?? ""),
    archived_at: String(r?.[11] ?? ""),
  };

  const tRes = await sheetsGet(TRIPS_RANGE);
  const tRows = tRes.values ?? [];
  const t = tRows.find((x: any[]) => String(x?.[0] ?? "").trim() === photo.trip_id);
  if (!t) return { trip: null as any, photo };

  const trip = {
    id: String(t?.[0] ?? ""),
    owner_user_id: String(t?.[5] ?? "").toLowerCase(),
    visibility: (String(t?.[8] ?? "").trim().toLowerCase() === "public" ? "public" : "private") as "public" | "private",
  };

  return { trip, photo };
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

    const { trip, photo } = await loadByPhotoId(id);
    if (!photo || !trip) return new Response("Not found", { status: 404 });
    if (photo.archived_at) return new Response("Not found", { status: 404 });

    const isOwner = !!viewerEmail && viewerEmail === trip.owner_user_id;

    if (trip.visibility === "private" && !isOwner) {
      return new Response("Not found", { status: 404 });
    }

    // próbáljuk a thumbnailLink-et
    if (photo.thumbnailLink) {
      const r = await fetch(photo.thumbnailLink, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (r.ok) {
        const headers = new Headers();
        headers.set("Content-Type", "image/jpeg");
        if (trip.visibility === "public") {
          headers.set("Cache-Control", "public, max-age=3600, s-maxage=3600");
        } else {
          headers.set("Cache-Control", "no-store");
        }
        return new Response(r.body, { status: 200, headers });
      }
    }

    // fallback: teljes fájl
    if (!accessToken) return new Response("Unauthorized", { status: 401 });
    const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(photo.drive_file_id)}?alt=media`;
    const r2 = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!r2.ok) {
      const txt = await r2.text().catch(() => "");
      return new Response(`Drive fetch error: ${r2.status} ${txt}`, { status: 502 });
    }

    const headers = new Headers();
    headers.set("Content-Type", photo.mimeType?.startsWith("image/") ? photo.mimeType : "image/jpeg");
    if (trip.visibility === "public") {
      headers.set("Cache-Control", "public, max-age=3600, s-maxage=3600");
    } else {
      headers.set("Cache-Control", "no-store");
    }
    return new Response(r2.body, { status: 200, headers });
  } catch (e: any) {
    console.error("/api/photos/thumb/[id] error:", e?.message || e);
    return new Response("Internal error", { status: 500 });
  }
}
