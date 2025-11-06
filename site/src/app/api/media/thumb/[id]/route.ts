import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sheetsGet } from "@/lib/sheets";

const MEDIA_RANGE = "Media!A2:O";

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

    const session: any = await getServerSession(authOptions);
    const accessToken: string = session?.accessToken || "";
    if (!accessToken) return new Response("Unauthorized", { status: 401 });

    const row = await findMediaRowById(id);
    if (!row) return new Response("Not found", { status: 404 });

    // r[5]=mimeType, r[8]=thumbnailLink, r[4]=drive_file_id
    const mimeType = String(row[5] ?? "") || "image/jpeg";
    const thumbLink = String(row[8] ?? "");
    const driveFileId = String(row[4] ?? "");

    // 1) ha van Google által adott thumbnailLink → kérjük le és proxizzuk
    if (thumbLink) {
      const r = await fetch(thumbLink, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (r.ok) {
        const headers = new Headers();
        headers.set("Content-Type", "image/jpeg");
        headers.set("Cache-Control", "public, max-age=3600, s-maxage=3600");
        return new Response(r.body, { status: 200, headers });
      }
      // ha a thumb nem jött le, esünk a file-fallbackre
    }

    // 2) fallback: a tényleges fájl (kisebb képeknél működik thumbként is)
    if (!driveFileId) return new Response("No drive_file_id", { status: 500 });
    const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
      driveFileId
    )}?alt=media`;

    const r2 = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!r2.ok) {
      const txt = await r2.text().catch(() => "");
      return new Response(`Drive fetch error: ${r2.status} ${txt}`, { status: 502 });
    }

    const headers = new Headers();
    headers.set("Content-Type", mimeType.startsWith("image/") ? mimeType : "image/jpeg");
    headers.set("Cache-Control", "public, max-age=3600, s-maxage=3600");
    return new Response(r2.body, { status: 200, headers });
  } catch (e: any) {
    console.error("/api/media/thumb/[id] error:", e?.message || e);
    return new Response("Internal error", { status: 500 });
  }
}
