import { NextResponse, NextRequest } from "next/server";
import { sheetsFindRowBy } from "@/lib/sheets";

// Photos sheet oszlopok:
// 0 id | 1 trip_id | 2 title | 3 drive_file_id | 4 mimeType
// 5 webViewLink | 6 webContentLink | 7 thumbnailLink | 8 size
// 9 created_at | 10 uploader | 11 archived_at
const PHOTOS_RANGE = "Photos!A2:L";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

function pickInlineUrl(mime: string, driveId: string, webViewLink: string, webContentLink: string) {
  const id = encodeURIComponent(driveId);
  // képek: inline megjelenítés
  if (mime?.startsWith("image/")) {
    return `https://drive.google.com/uc?export=view&id=${id}`;
  }
  // pdf: preview viewer
  if (mime === "application/pdf") {
    return `https://drive.google.com/file/d/${id}/preview`;
  }
  // egyéb: view link/fallback
  return webViewLink || `https://drive.google.com/file/d/${id}/view` || webContentLink;
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;

  const { row } = await sheetsFindRowBy(PHOTOS_RANGE, r => (r?.[0] || "") === id);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // archivált?
  if (String(row[11] || "")) return NextResponse.json({ error: "Archived" }, { status: 410 });

  const driveId = String(row[3] || "");
  const mime = String(row[4] || "");
  const webView = String(row[5] || "");
  const webContent = String(row[6] || "");

  if (!driveId) return NextResponse.json({ error: "Missing drive_file_id" }, { status: 400 });

  const url = pickInlineUrl(mime, driveId, webView, webContent);
  if (!url) return NextResponse.json({ error: "No inline URL" }, { status: 404 });

  // 302 redirect a megjeleníthető URL-re
  return NextResponse.redirect(url);
}
