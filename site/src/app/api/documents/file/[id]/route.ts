import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sheetsFindRowBy, sheetsGet } from "@/lib/sheets";

// Documents: 0 id | 1 trip_id | 2 title | 3 drive_file_id | 4 mimeType
// 5 webViewLink | 6 webContentLink | 7 thumbnailLink | 8 size | 9 created_at
// 10 uploader | 11 archived_at | 12 doc_visibility
const DOCS_RANGE  = "Documents!A2:M";
const TRIPS_RANGE = "Trips!A2:I"; // owner @ index 5

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

async function getTripOwnerEmail(tripId: string) {
  const { values } = await sheetsGet(TRIPS_RANGE);
  const rows = values ?? [];
  const hit = rows.find(r => String(r?.[0] || "") === tripId);
  return hit ? String(hit[5] || "").toLowerCase() : null;
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const { row } = await sheetsFindRowBy(DOCS_RANGE, r => (r?.[0] || "") === id);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (String(row[11] || "")) return NextResponse.json({ error: "Archived" }, { status: 410 });

  const tripId = String(row[1] || "");
  const visibility = String(row[12] || "private").toLowerCase() as "public"|"private";

  if (visibility === "private") {
    // csak a tulaj
    const session: any = await getServerSession(authOptions);
    const email = (session?.user?.email || "").toLowerCase();
    const owner = (await getTripOwnerEmail(tripId)) || "";
    if (!email || email !== owner) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const webContent = String(row[6] || "");
  const driveId = String(row[3] || "");
  const fallback = driveId ? `https://drive.google.com/uc?id=${encodeURIComponent(driveId)}&export=download` : "";
  const url = webContent || fallback;
  if (!url) return NextResponse.json({ error: "No link" }, { status: 404 });

  return NextResponse.redirect(url);
}

