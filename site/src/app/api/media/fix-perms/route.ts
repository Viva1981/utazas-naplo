import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sheetsGet } from "@/lib/sheets";
import { driveSetAnyoneReader } from "@/lib/drive";

// Media (A..O): A:id B:trip_id C:type D:title E:drive_file_id F:mimeType G:webViewLink H:webContentLink
//               I:thumbnailLink J:size K:created_at L:uploader_user_id M:archived_at N:category O:media_visibility
const MEDIA_RANGE = "Media!A2:O";
// Trips (A..I): A:id ... F:owner_user_id ... I:visibility
const TRIPS_RANGE = "Trips!A2:I";

type MediaRow = string[];
type TripRow = string[];

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * POST /api/media/fix-perms?trip_id=TRIP_...
 * Beállítja az “anyone reader” jogosultságot a megadott trip ÖSSZES
 * publikus képére (category=image, media_visibility=public), archiváltakat kihagyja.
 * Csak a trip tulajdonosa futtathatja.
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const me =
    ((session as any)?.userId as string | undefined) ||
    ((session?.user as any)?.email as string | undefined) ||
    "";
  const meLc = me.toLowerCase();

  const url = new URL(req.url);
  const tripId = (url.searchParams.get("trip_id") || "").trim();
  if (!tripId) return NextResponse.json({ error: "Missing trip_id" }, { status: 400 });

  // Access token a sessionből
  const accessToken =
    (session as any).accessToken ||
    (session as any)?.user?.accessToken ||
    (session as any)?.user?.token ||
    null;
  if (!accessToken) {
    return NextResponse.json({ error: "Missing OAuth access token in session" }, { status: 401 });
  }

  // Ellenőrizzük, hogy a hívó a trip tulajdonosa-e
  const tripsRes = await sheetsGet(TRIPS_RANGE);
  const trows: TripRow[] = tripsRes.values ?? [];
  const t = trows.find((r) => (r[0] || "") === tripId);
  const owner = ((t?.[5] || "") as string).toLowerCase();
  if (!t || !owner || owner !== meLc) {
    return NextResponse.json({ error: "Forbidden (only trip owner can run)" }, { status: 403 });
  }

  // Media sorok beolvasása
  const mediaRes = await sheetsGet(MEDIA_RANGE);
  const rows: MediaRow[] = mediaRes.values ?? [];

  // Szűrés: adott trip, nem archivált, category=image, media_visibility=public
  const candidates = rows.filter((r) => {
    const rTrip = r[1];  // B
    const archived = r[12]; // M
    const cat = (r[13] || "").toLowerCase(); // N
    const vis = (r[14] || "").toLowerCase(); // O
    return rTrip === tripId && !archived && cat === "image" && vis === "public";
  });

  let ok = 0;
  const failed: { fileId: string; error: string }[] = [];

  for (const r of candidates) {
    const fileId = r[4]; // E: drive_file_id
    if (!fileId) continue;
    try {
      await driveSetAnyoneReader(accessToken, fileId);
      ok++;
    } catch (e: any) {
      failed.push({ fileId, error: String(e?.message || e) });
    }
  }

  return NextResponse.json({
    ok: true,
    trip_id: tripId,
    processed: candidates.length,
    fixed: ok,
    failed,
  });
}
