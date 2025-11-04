import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sheetsGet } from "@/lib/sheets";

// Media (A..O):
// A:id | B:trip_id | C:type | D:title | E:drive_file_id | F:mimeType | G:webViewLink | H:webContentLink |
// I:thumbnailLink | J:size | K:created_at | L:uploader_user_id | M:archived_at | N:category | O:media_visibility
const MEDIA_RANGE = "Media!A2:O";

// Trips (A..I):
// A:id | B:title | C:start_date | D:end_date | E:destination | F:owner_user_id | G:drive_folder_id | H:drive_folder_link | I:visibility
const TRIPS_RANGE = "Trips!A2:I";

type MediaRow = string[];
type TripRow = string[];

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  // ⬅️ Next 14/16: params Promise, ezért await
  const { id: tripId } = await ctx.params;

  const session = await getServerSession(authOptions);
  const me =
    ((session as any)?.userId as string | undefined) ||
    ((session?.user as any)?.email as string | undefined) ||
    "";

  // Trip olvasás (láthatóság + owner)
  const tripsRes = await sheetsGet(TRIPS_RANGE);
  const trip = (tripsRes.values ?? [])
    .map((r: TripRow) => ({
      id: r[0],
      owner_user_id: r[5],
      visibility: (r[8] || "private").toLowerCase() as "public" | "private",
    }))
    .find((t) => t.id === tripId);

  const isOwner =
    !!(me && trip?.owner_user_id && me.toLowerCase() === trip.owner_user_id.toLowerCase());
  const isTripPublic = trip?.visibility === "public";

  // Media beolvasás
  const mediaRes = await sheetsGet(MEDIA_RANGE);
  const rows: MediaRow[] = mediaRes.values ?? [];

  const items = rows
    .filter((r) => r[1] === tripId && !r[12]) // B:trip_id egyezik, M:archived_at üres
    .map((r) => {
      const id = r[0];                       // A
      const title = r[3] || "";              // D
      const drive_file_id = r[4];            // E
      const uploader_user_id = r[11] || "";  // L
      const category = (r[13] || "").toLowerCase() as "image" | "document"; // N
      const media_visibility = (r[14] || "public").toLowerCase() as "public" | "private"; // O

      const thumbUrl = `/api/media/file/${drive_file_id}`;
      return {
        id,
        trip_id: tripId,
        title,
        drive_file_id,
        thumbUrl,
        uploader_user_id,
        category,
        media_visibility,
      };
    });

  // Szétbontás + láthatóság a dokumentumokra
  const images = items.filter((m) => m.category === "image");
  let documents = items.filter((m) => m.category === "document");

  // ha nem tulaj és a trip publikus: privát doksikat NE adjuk vissza
  if (!isOwner && isTripPublic) {
    documents = documents.filter((d) => d.media_visibility !== "private");
  }

  return NextResponse.json({
    images,
    documents,
    is_owner: isOwner,
    is_trip_public: isTripPublic,
  });
}
