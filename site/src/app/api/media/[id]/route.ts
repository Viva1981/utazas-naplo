import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sheetsGet } from "@/lib/sheets";

// Media (A..O):  A:id B:trip_id C:type D:title E:drive_file_id F:mimeType G:webViewLink H:webContentLink
//                I:thumbnailLink J:size K:created_at L:uploader_user_id M:archived_at N:category O:media_visibility
const MEDIA_RANGE = "Media!A2:O";
const TRIPS_RANGE = "Trips!A2:I"; // A:id ... F:owner_user_id ... I:visibility

export const runtime = "nodejs";
export const revalidate = 0;
export const dynamic = "force-dynamic";

type MediaRow = string[];
type TripRow = string[];

/**
 * GET /api/media/[id]  → átirányít Drive megjeleníthető URL-re
 * - Képek: https://drive.google.com/uc?export=view&id=FILE_ID  (img kompatibilis)
 * - PDF/egyéb: webViewLink vagy webContentLink
 * - Láthatóság: privát doksi csak tulaj/uploader láthatja
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const fileId = params.id;

  // Bejelentkezett user e-mailje (ha van)
  const session = await getServerSession(authOptions);
  const requester = (
    ((session as any)?.userId as string | undefined) ||
    ((session?.user as any)?.email as string | undefined) ||
    ""
  ).toLowerCase();

  // Media táblából kikeressük a sort a drive_file_id alapján (E oszlop = index 4)
  const mediaRes = await sheetsGet(MEDIA_RANGE);
  const rows: MediaRow[] = mediaRes.values ?? [];
  const row = rows.find((r) => (r[4] || "") === fileId);

  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const tripId = row[1];                         // B
  const mimeType = (row[5] || "").toLowerCase(); // F
  const webViewLink = row[6] || "";              // G
  const webContentLink = row[7] || "";           // H
  const uploaderUserId = (row[11] || "").toLowerCase(); // L
  const archivedAt = row[12];                    // M
  const category = (row[13] || "").toLowerCase();       // N
  const mediaVisibility = (row[14] || "public").toLowerCase(); // O

  if (archivedAt) {
    return NextResponse.json({ error: "Archived" }, { status: 410 });
  }

  // Trip tulaj azonosítása (privát ellenőrzéshez)
  const tripsRes = await sheetsGet(TRIPS_RANGE);
  const trows: TripRow[] = tripsRes.values ?? [];
  const tripRow = trows.find((t) => (t[0] || "") === tripId);
  const owner = ((tripRow?.[5] || "") as string).toLowerCase(); // F:owner_user_id

  const isOwner = !!owner && owner === requester;
  const isUploader = !!uploaderUserId && uploaderUserId === requester;

  // Privát doksi esetén csak tulaj/uploader férhet hozzá
  if (category === "document" && mediaVisibility === "private" && !(isOwner || isUploader)) {
    // 403, de adjunk vissza kis SVG-t, hogy a UI ne törjön
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200"><rect width="100%" height="100%" fill="#f3f3f3"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#888" font-family="sans-serif" font-size="14">Privát dokumentum</text></svg>`;
    return new NextResponse(svg, {
      status: 403,
      headers: { "Content-Type": "image/svg+xml", "Cache-Control": "no-store" },
    });
  }

  // Megjeleníthető Drive URL kiválasztása
  const isImage = mimeType.startsWith("image/");
  const isPdf = mimeType === "application/pdf";

  const redirectUrl =
    isImage
      ? `https://drive.google.com/uc?export=view&id=${fileId}`
      : isPdf
        ? (webViewLink || `https://drive.google.com/file/d/${fileId}/view`)
        : (webContentLink || `https://drive.google.com/uc?export=download&id=${fileId}`);

  return NextResponse.redirect(redirectUrl, {
    status: 302,
    headers: { "Cache-Control": "private, max-age=60" },
  });
}
