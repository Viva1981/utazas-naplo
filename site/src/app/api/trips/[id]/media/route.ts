import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sheetsGet } from "@/lib/sheets";

// Media: id | trip_id | type | title | drive_file_id | uploader_user_id | archived_at | category | media_visibility | is_cover | uploaded_at
const MEDIA_RANGE = "Media!A2:K";
// Trips: id | title | start | end | destination | owner | folderId | folderLink | visibility
const TRIPS_RANGE = "Trips!A2:I";

type MediaRow = string[];
type TripRow = string[];

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const session = await getServerSession(authOptions);
  const me =
    ((session as any)?.userId as string | undefined) ||
    ((session?.user as any)?.email as string | undefined) ||
    "";

  const tripId = params.id;

  // Trip olvasás (láthatóság + owner)
  const tripsRes = await sheetsGet(TRIPS_RANGE);
  const trip = (tripsRes.values ?? [])
    .map((r: TripRow) => ({
      id: r[0],
      owner_user_id: r[5],
      visibility: (r[8] || "private").toLowerCase() as "public" | "private",
    }))
    .find((t: any) => t.id === tripId);

  const isOwner =
    !!(me && trip?.owner_user_id && me.toLowerCase() === trip.owner_user_id.toLowerCase());
  const isTripPublic = trip?.visibility === "public";

  const mediaRes = await sheetsGet(MEDIA_RANGE);
  const rows: MediaRow[] = mediaRes.values ?? [];

  const items = rows
    .filter((r) => r[1] === tripId && !r[6]) // trip_id egyezik és nincs archived_at
    .map((r) => {
      const [id, , , title, drive_file_id, uploader, , category, media_visibility] = r;
      const thumbUrl = `/api/media/file/${drive_file_id}`;
      return {
        id,
        trip_id: tripId,
        title: title || "",
        drive_file_id,
        thumbUrl,
        uploader_user_id: uploader || "",
        category: (category || "").toLowerCase() as "image" | "document",
        media_visibility: (media_visibility || "public").toLowerCase() as "public" | "private",
      };
    });

  // Szétbontás + láthatóság a dokumentumokra
  const images = items.filter((m) => m.category === "image");
  let documents = items.filter((m) => m.category === "document");

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
