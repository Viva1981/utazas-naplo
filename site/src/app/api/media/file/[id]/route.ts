// site/src/app/api/media/file/[id]/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sheetsGet } from "@/lib/sheets";

const MEDIA_RANGE = "Media!A2:O";
const TRIPS_RANGE = "Trips!A2:I";

type MediaRow = string[];
type TripRow = string[];

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> } // ⬅️ params lehet Promise
) {
  const { id: fileId } = await ctx.params; // ⬅️ await a params-ra
  if (!fileId) return NextResponse.json({ error: "Missing file id" }, { status: 400 });

  const session = await getServerSession(authOptions);
  const me =
    ((session as any)?.userId as string | undefined) ||
    ((session?.user as any)?.email as string | undefined) ||
    "";

  // Trips tulajok → jogosultsághoz
  const tripsRes = await sheetsGet(TRIPS_RANGE);
  const tripRows: TripRow[] = tripsRes.values ?? [];
  const tripOwnerById = new Map<string, string>();
  for (const r of tripRows) {
    const tid = r[0];
    const owner = (r[5] || "").toLowerCase();
    if (tid) tripOwnerById.set(tid, owner);
  }

  // Media rekord keresése a drive_file_id alapján
  const mediaRes = await sheetsGet(MEDIA_RANGE);
  const rows: MediaRow[] = mediaRes.values ?? [];

  const hit = rows
    .map((r) => {
      const [
        id, trip_id, , , drive_file_id, mimeType, , webContentLink, , , ,
        uploader_user_id, archived_at, category, media_visibility,
      ] = r;
      return {
        id,
        trip_id,
        drive_file_id,
        mimeType,
        webContentLink,
        uploader_user_id,
        archived_at,
        category: (category || "").toLowerCase() as "image" | "document" | "",
        media_visibility: (media_visibility || "public").toLowerCase() as "public" | "private",
      };
    })
    .find((m) => m.drive_file_id === fileId);

  if (!hit || hit.archived_at) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // jogosultság: public bárkinek; private csak uploadernek vagy trip tulajnak
  const isPublic = hit.media_visibility === "public";
  const meLc = (me || "").toLowerCase();
  const uploaderLc = (hit.uploader_user_id || "").toLowerCase();
  const tripOwnerLc = (tripOwnerById.get(hit.trip_id) || "").toLowerCase();

  const allowed = isPublic || (meLc && (meLc === uploaderLc || meLc === tripOwnerLc));
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const redirectUrl = hit.webContentLink
    ? hit.webContentLink
    : `https://drive.google.com/uc?export=download&id=${fileId}`;

  return NextResponse.redirect(redirectUrl, { status: 302 });
}
