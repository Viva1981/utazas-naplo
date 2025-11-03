// site/src/app/api/media/list/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sheetsGet } from "@/lib/sheets";

// Media: A:id B:trip_id C:type D:title E:drive_file_id F:mimeType G:webViewLink H:webContentLink
// I:thumbnailLink J:size K:created_at L:uploader_user_id M:archived_at N:category O:media_visibility
const MEDIA_RANGE = "Media!A2:O";
// Trips: A:id B:title C:start D:end E:destination F:owner_user_id G:folderId H:folderLink I:visibility
const TRIPS_RANGE = "Trips!A2:I";

type MediaRow = string[];
type TripRow = string[];

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const me =
    ((session as any)?.userId as string | undefined) ||
    ((session?.user as any)?.email as string | undefined) ||
    "";

  const { searchParams } = new URL(req.url);
  const tripIdFilter = (searchParams.get("trip_id") || "").trim();

  // Trips: kell a trip tulaja a jogosultság eldöntéséhez
  const tripsRes = await sheetsGet(TRIPS_RANGE);
  const tripRows: TripRow[] = tripsRes.values ?? [];
  const tripOwnerById = new Map<string, string>();
  for (const r of tripRows) {
    const id = r[0];
    const owner = (r[5] || "").toLowerCase();
    if (id) tripOwnerById.set(id, owner);
  }

  const mediaRes = await sheetsGet(MEDIA_RANGE);
  const rows: MediaRow[] = mediaRes.values ?? [];

  const items = rows
    .map((r) => {
      const [
        id, trip_id, type, title, drive_file_id, mimeType, webViewLink, webContentLink,
        thumbnailLink, size, created_at, uploader_user_id, archived_at, category, media_visibility,
      ] = r;

      return {
        id,
        trip_id,
        type,
        title,
        drive_file_id,
        mimeType,
        webViewLink,
        webContentLink,
        thumbnailLink,
        size,
        created_at,
        uploader_user_id,
        archived_at,
        category: (category || "").toLowerCase() as "image" | "document" | "",
        media_visibility: (media_visibility || "public").toLowerCase() as "public" | "private",
      };
    })
    // archivált kiesik
    .filter((m) => !m.archived_at)
    // ha van trip_id filter, szűrjük
    .filter((m) => (tripIdFilter ? m.trip_id === tripIdFilter : true))
    // LÁTHATÓSÁG SZŰRÉS:
    // - public: mindenki
    // - private: csak a feltöltő VAGY a trip tulajdonosa (uploader_user_id vagy trip.owner_user_id == me)
    .filter((m) => {
      if (m.media_visibility === "public") return true;
      if (!me) return false;
      const meLc = me.toLowerCase();
      const uploaderLc = (m.uploader_user_id || "").toLowerCase();
      const tripOwnerLc = (tripOwnerById.get(m.trip_id) || "").toLowerCase();
      return meLc && (meLc === uploaderLc || meLc === tripOwnerLc);
    });

  return NextResponse.json({ items });
}
