import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sheetsFindRowBy, sheetsUpdateRange } from "@/lib/sheets";
import { driveDeleteFile } from "@/lib/drive";

const MEDIA_RANGE = "Media!A2:M";    // 0..12: id..archived_at
const TRIPS_RANGE = "Trips!A2:H";    // id..owner_user_id..folder_link

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params; // media id
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sessionUser =
    ((session as any).userId as string | undefined) ||
    ((session.user as any)?.email as string | undefined) ||
    "";
  if (!sessionUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // 1) Media sor megkeresése
  const { index: mediaIdx, row: mediaRow } = await sheetsFindRowBy(
    MEDIA_RANGE,
    (r) => (r?.[0] || "") === id
  );
  if (mediaIdx < 0 || !mediaRow) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const tripId           = mediaRow[1] || "";
  const driveFileId      = mediaRow[4] || "";
  const uploaderUserId   = (mediaRow[11] || "").toLowerCase();
  const archivedAlready  = (mediaRow[12] || "").trim();

  if (archivedAlready) {
    // már törölt/archivált -> legyen idempotens
    return NextResponse.json({ ok: true, archived: true });
  }

  // 2) Jogosultság: uploader VAGY trip owner törölhet
  const requester = sessionUser.toLowerCase();

  // trip owner felkutatása
  let isOwner = false;
  if (tripId) {
    const { row: tripRow } = await sheetsFindRowBy(
      TRIPS_RANGE,
      (r) => (r?.[0] || "") === tripId
    );
    const owner = (tripRow?.[5] || "").toLowerCase(); // owner_user_id
    isOwner = !!owner && owner === requester;
  }

  const isUploader = !!uploaderUserId && uploaderUserId === requester;

  if (!isUploader && !isOwner) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 3) Drive törlés (trash-be, de Drive API-val DELETE)
  const accessToken = (session as any).accessToken as string | undefined;
  if (!accessToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (driveFileId) {
    try {
      await driveDeleteFile(accessToken, driveFileId);
    } catch (e) {
      // Ha a Drive törlés nem sikerül, ne vesszünk el – de logoljuk:
      console.error("Drive delete error:", e);
    }
  }

  // 4) archived_at kitöltése a Media sorban
  const targetA1 = `Media!A${2 + mediaIdx}:M${2 + mediaIdx}`;
  const updated = [...mediaRow];
  while (updated.length < 13) updated.push("");
  updated[12] = new Date().toISOString(); // M: archived_at

  await sheetsUpdateRange(targetA1, [updated]);

  return NextResponse.json({ ok: true });
}
