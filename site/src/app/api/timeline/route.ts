import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sheetsGet } from "@/lib/sheets";

// Trips: id | title | start | end | destination | owner | folderId | folderLink | visibility
const TRIPS_RANGE = "Trips!A2:I";
// Media: id | trip_id | type | title | drive_file_id | uploader_user_id | archived_at?
const MEDIA_RANGE = "Media!A2:G";

type TripRow = string[];
type MediaRow = string[];

export async function GET() {
  const session = await getServerSession(authOptions);
  const me =
    ((session as any)?.userId as string | undefined) ||
    ((session?.user as any)?.email as string | undefined) ||
    "";

  // 1) Összes trip beolvasása
  const tripsRes = await sheetsGet(TRIPS_RANGE);
  const tripRows: TripRow[] = tripsRes.values ?? [];

  // 2) Láthatóság szűrés: public VAGY saját privát
  const trips = tripRows
    .map((r) => ({
      id: r[0],
      title: r[1],
      start_date: r[2],
      end_date: r[3],
      destination: r[4],
      owner_user_id: r[5],
      visibility: (r[8] || "private").toLowerCase() as "public" | "private",
    }))
    .filter((t) => {
      if (t.visibility === "public") return true;
      return (
        me &&
        t.owner_user_id &&
        me.toLowerCase() === t.owner_user_id.toLowerCase()
      );
    });

  // 3) Borítókép (első képfájl) hozzárendelése
  const mediaRes = await sheetsGet(MEDIA_RANGE);
  const mediaRows: MediaRow[] = mediaRes.values ?? [];

  const firstImageByTrip = new Map<string, { thumbUrl: string; driveId: string }>();
  for (const r of mediaRows) {
    const [, trip_id, type, , drive_file_id, , archived_at] = r;
    if (!trip_id || !drive_file_id) continue;
    if (archived_at) continue; // archiváltat hagyjuk ki
    const isImage = (type || "").toLowerCase() === "file"; // nálunk minden 'file', thumb a drive id-ból lesz
    if (!firstImageByTrip.has(trip_id) && isImage) {
      // Drive előnézet (saját proxy endpointodra is cserélhető)
      const thumbUrl = `/api/media/file/${drive_file_id}`;
      firstImageByTrip.set(trip_id, { thumbUrl, driveId: drive_file_id });
    }
  }

  // 4) Összeállítás + rendezés (legújabb elöl) + is_owner flag az UI-nak
  const items = trips
    .map((t) => {
      const is_owner =
        !!(me && t.owner_user_id && me.toLowerCase() === t.owner_user_id.toLowerCase());
      return {
        ...t,
        is_owner,
        cover_thumb: firstImageByTrip.get(t.id)?.thumbUrl || "",
      };
    })
    .sort((a, b) => (b.start_date || "").localeCompare(a.start_date || ""));

  return NextResponse.json({ items });
}
