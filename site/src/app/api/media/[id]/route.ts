// site/src/app/api/media/[id]/route.ts  (TELJES CSERE)

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sheetsGet } from "@/lib/sheets";

const MEDIA_RANGE = "Media!A2:O";
// Media oszlopok (index):
// 0:id | 1:trip_id | 2:type | 3:title | 4:drive_file_id | 5:mimeType | 6:webViewLink | 7:webContentLink
// 8:thumbnailLink | 9:size | 10:createdAt | 11:uploaderUserId | 12:deleted? | 13:category | 14:media_visibility

const TRIPS_RANGE = "Trips!A2:I";
// Trips oszlopok (index):
// 0:id | 1:title | 2:start | 3:end | 4:destination | 5:owner_user_id | 6:folderId | 7:folderLink | 8:visibility

const norm = (s?: string) => (s ?? "").trim().toLowerCase();

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const wanted = (id || "").trim();
  if (!wanted) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  // --- Media beolvasása ---
  const { values: mediaRows } = await sheetsGet(MEDIA_RANGE);
  const mrows = (mediaRows ?? []) as string[][];
  const row = mrows.find((r) => norm(r?.[0]) === norm(wanted) && !(r?.[12] ?? "")); // ne legyen törölt

  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const media = {
    id: row[0],
    trip_id: row[1],
    type: row[2],
    title: row[3],
    drive_file_id: row[4],
    mimeType: row[5],
    webViewLink: row[6],
    webContentLink: row[7],
    thumbnailLink: row[8],
    size: row[9],
    createdAt: row[10],
    uploaderUserId: (row[11] || "").toLowerCase(),
    category: (row[13] || "").toLowerCase(),
    media_visibility: ((row[14] || "private") as "public" | "private"),
  };

  // --- Jogosultság: public oké; private → uploader VAGY trip owner ---
  if (media.media_visibility !== "public") {
    const session = await getServerSession(authOptions);
    const me =
      ((((session as any)?.userId) as string | undefined) ||
        (((session?.user as any)?.email) as string | undefined) ||
        "")
        .trim()
        .toLowerCase();

    if (!me) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // ha az uploader vagyok → oké
    const isUploader = me === media.uploaderUserId;

    // ha a Trip tulaja vagyok → oké
    let isTripOwner = false;
    if (!isUploader) {
      const { values: tripRows } = await sheetsGet(TRIPS_RANGE);
      const trows = (tripRows ?? []) as string[][];
      const t = trows.find((r) => norm(r?.[0]) === norm(media.trip_id));
      const owner = (t?.[5] || "").toLowerCase();
      isTripOwner = !!owner && owner === me;
    }

    if (!isUploader && !isTripOwner) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  // --- Válasz (metaadatok) ---
  return NextResponse.json(
    {
      id: media.id,
      trip_id: media.trip_id,
      type: media.type,
      title: media.title,
      drive_file_id: media.drive_file_id,
      mimeType: media.mimeType,
      webViewLink: media.webViewLink,
      webContentLink: media.webContentLink,
      thumbnailLink: media.thumbnailLink,
      size: media.size,
      createdAt: media.createdAt,
      uploaderUserId: media.uploaderUserId,
      category: media.category,
      media_visibility: media.media_visibility,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
