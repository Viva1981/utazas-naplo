import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sheetsGet, sheetsUpdateRange } from "@/lib/sheets";
import { driveDeleteFile } from "@/lib/drive";

// Media: A..O  (A:id B:trip_id C:type D:title E:drive_file_id F:mimeType G:webViewLink H:webContentLink
//               I:thumbnailLink J:size K:created_at L:uploader_user_id M:archived_at N:category O:media_visibility)
const MEDIA_RANGE_ALL = "Media!A2:O";

type MediaRow = string[];

// GET: (opcionális) visszaadja a media sort
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params; // A oszlopos saját media id (nem a drive id)
  const res = await sheetsGet(MEDIA_RANGE_ALL);
  const rows: MediaRow[] = res.values ?? [];
  const row = rows.find((r) => (r[0] || "") === id);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    id: row[0], trip_id: row[1], title: row[3],
    drive_file_id: row[4], mimeType: row[5],
    uploader_user_id: row[11], archived_at: row[12],
    category: row[13], media_visibility: row[14],
  });
}

// DELETE: csak tulaj vagy feltöltő törölhet
export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const requester =
    ((session as any)?.userId as string | undefined) ||
    ((session?.user as any)?.email as string | undefined) ||
    "";
  const requesterLc = (requester || "").toLowerCase();

  const { id } = await ctx.params; // media.id (A oszlop)
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const res = await sheetsGet(MEDIA_RANGE_ALL);
  const rows: MediaRow[] = res.values ?? [];
  const idx = rows.findIndex((r) => (r[0] || "") === id);
  if (idx === -1) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const row = rows[idx];
  const driveId = row[4];                          // E
  const uploaderLc = (row[11] || "").toLowerCase(); // L
  const archivedAt = row[12];                      // M

  // csak a feltöltő törölhet (ha akarsz tulajt is, itt bővíthető)
  const canDelete = !!uploaderLc && uploaderLc === requesterLc;
  if (!canDelete) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Drive-ból törlés (ha nincs jog/hiba, ne álljon meg a sor frissítése)
  try {
    const accessToken =
      (session as any).accessToken ||
      (session as any)?.user?.accessToken ||
      (session as any)?.user?.token ||
      null;
    if (accessToken && driveId && !archivedAt) {
      await driveDeleteFile(accessToken, driveId);
    }
  } catch (e) {
    console.warn("Drive delete warning:", e);
  }

  // Media sor "archiválása" (M oszlopba timestamp)
  const sheetRow = idx + 2; // fejléc miatt +2
  await sheetsUpdateRange(`Media!M${sheetRow}:M${sheetRow}`, [[new Date().toISOString()]]);

  return NextResponse.json({ ok: true, id });
}

// (ha kell) PATCH ide tehető később (pl. cím módosítás)
