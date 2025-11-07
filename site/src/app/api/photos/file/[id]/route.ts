import { NextResponse, NextRequest } from "next/server";
import { sheetsFindRowBy } from "@/lib/sheets";

// Photos: 0 id | 1 trip_id | 2 title | 3 drive_file_id | 4 mimeType
// 5 webViewLink | 6 webContentLink | 7 thumbnailLink | 8 size | 9 created_at | 10 uploader | 11 archived_at
const PHOTOS_RANGE = "Photos!A2:L";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const { row } = await sheetsFindRowBy(PHOTOS_RANGE, r => (r?.[0] || "") === id);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (String(row[11] || "")) return NextResponse.json({ error: "Archived" }, { status: 410 });

  // próbáljuk a webContentLink-et; ha nincs, fallback az uc?id=... linkre
  const webContent = String(row[6] || "");
  const driveId = String(row[3] || "");
  const fallback = driveId ? `https://drive.google.com/uc?id=${encodeURIComponent(driveId)}&export=download` : "";
  const url = webContent || fallback;
  if (!url) return NextResponse.json({ error: "No link" }, { status: 404 });

  // 302 redirect – a böngésző közvetlenül a Drive-ból tölti
  return NextResponse.redirect(url);
}
