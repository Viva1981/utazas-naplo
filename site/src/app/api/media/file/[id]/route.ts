import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sheetsGet } from "@/lib/sheets";

const MEDIA_RANGE = "Media!A2:O"; // id..media_visibility

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

async function findMediaRowById(id: string) {
  const { values } = await sheetsGet(MEDIA_RANGE);
  const rows = values ?? [];
  const row = rows.find((r: any[]) => String(r?.[0] ?? "").trim() === id);
  return row;
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id?: string }> }
) {
  try {
    const p = await ctx.params;
    const id = (p?.id ?? "").trim();
    if (!id) return new Response("Missing id", { status: 400 });

    // session (Google accessToken kell a privát Drive letöltéshez)
    const session: any = await getServerSession(authOptions);
    const accessToken: string = session?.accessToken || "";
    if (!accessToken) return new Response("Unauthorized", { status: 401 });

    const row = await findMediaRowById(id);
    if (!row) return new Response("Not found", { status: 404 });

    // Media oszloprend: id, trip_id, type, title, drive_file_id, mimeType, webViewLink, webContentLink, thumbnailLink, size, created_at, uploader_user_id, archived_at, category, media_visibility
    const driveFileId = String(row[4] ?? "");
    const mimeType = String(row[5] ?? "") || "application/octet-stream";

    if (!driveFileId) return new Response("No drive_file_id", { status: 500 });

    // Drive API: tartalom
    const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
      driveFileId
    )}?alt=media`;

    const r = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!r.ok) {
      const txt = await r.text().catch(() => "");
      return new Response(`Drive fetch error: ${r.status} ${txt}`, { status: 502 });
    }

    // Proxyzzuk vissza az adatfolyamot
    const headers = new Headers();
    headers.set("Content-Type", mimeType);
    headers.set("Cache-Control", "public, max-age=3600, s-maxage=3600"); // óvatos cache
    return new Response(r.body, { status: 200, headers });
  } catch (e: any) {
    console.error("/api/media/file/[id] error:", e?.message || e);
    return new Response("Internal error", { status: 500 });
  }
}
