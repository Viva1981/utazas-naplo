import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sheetsFindRowBy, sheetsGet } from "@/lib/sheets";

// Documents sheet oszlopok:
// 0 id | 1 trip_id | 2 title | 3 drive_file_id | 4 mimeType
// 5 webViewLink | 6 webContentLink | 7 thumbnailLink | 8 size
// 9 created_at | 10 uploader | 11 archived_at | 12 doc_visibility
const DOCS_RANGE  = "Documents!A2:M";

// Trips sheet (owner e-mail az index 5)
const TRIPS_RANGE = "Trips!A2:I";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

async function getTripOwnerEmail(tripId: string) {
  const { values } = await sheetsGet(TRIPS_RANGE);
  const rows = values ?? [];
  const r = rows.find((x: any[]) => String(x?.[0] || "") === tripId);
  return r ? String(r[5] || "").toLowerCase() : null;
}

function pickInlineUrl(mime: string, driveId: string, webViewLink: string, webContentLink: string) {
  const id = encodeURIComponent(driveId);
  if (mime?.startsWith("image/")) {
    return `https://drive.google.com/uc?export=view&id=${id}`;
  }
  if (mime === "application/pdf") {
    return `https://drive.google.com/file/d/${id}/preview`;
  }
  return webViewLink || `https://drive.google.com/file/d/${id}/view` || webContentLink;
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;

  const { row } = await sheetsFindRowBy(DOCS_RANGE, r => (r?.[0] || "") === id);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // archivált?
  if (String(row[11] || "")) return NextResponse.json({ error: "Archived" }, { status: 410 });

  const tripId = String(row[1] || "");
  const visibility = (String(row[12] || "private").toLowerCase() as "public" | "private");

  // privát dokumentum → csak a tulaj láthatja
  if (visibility === "private") {
    const session: any = await getServerSession(authOptions);
    const email = (session?.user?.email || "").toLowerCase();
    const owner = (await getTripOwnerEmail(tripId)) || "";
    if (!email || email !== owner) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const driveId = String(row[3] || "");
  const mime = String(row[4] || "");
  const webView = String(row[5] || "");
  const webContent = String(row[6] || "");
  if (!driveId) return NextResponse.json({ error: "Missing drive_file_id" }, { status: 400 });

  const url = pickInlineUrl(mime, driveId, webView, webContent);
  if (!url) return NextResponse.json({ error: "No inline URL" }, { status: 404 });

  return NextResponse.redirect(url);
}
