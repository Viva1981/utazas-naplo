import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sheetsGet, sheetsAppend, sheetsUpdateRange } from "@/lib/sheets";
import {
  driveUploadFile,
  driveGetFileMeta,
  driveCreateFolder,
  driveSetAnyoneReader,
  driveEnsureParent,
} from "@/lib/drive";

const MEDIA_RANGE = "Media!A2:O";
const TRIPS_RANGE = "Trips!A2:I";   // 0:id | 1:title | ... | 5:owner email | 6:folderId | 7:folderLink | 8:visibility
const USERS_RANGE = "Users!A2:D";

export const runtime = "nodejs";

async function ensureUserFolder(accessToken: string, userId: string, userName: string, rootFolderId: string) {
  const usersRes = await sheetsGet(USERS_RANGE);
  const rows: string[][] = usersRes.values ?? [];

  let rowIndex = -1;
  let folderId = "";
  let folderLink = "";

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if ((r[0] || "").toLowerCase() === userId.toLowerCase()) {
      rowIndex = i;
      folderId = r[3] ? r[3] : r[2] || ""; // támogatjuk a te oszlopsorrendedet is
      folderLink = r[4] ? r[4] : r[3] || ""; // ha van role oszlop, ne omoljon
      break;
    }
  }

  if (rowIndex === -1) {
    const created = await driveCreateFolder(accessToken, userName || userId, rootFolderId);
    folderId = created.id;
    folderLink = created.webViewLink || "";
    await sheetsAppend(USERS_RANGE, [userId, userId, userName || "", folderId, folderLink]);
    return { folderId, folderLink };
  }

  if (!folderId) {
    const created = await driveCreateFolder(accessToken, userName || userId, rootFolderId);
    folderId = created.id;
    folderLink = created.webViewLink || "";
    const rowNumber = rowIndex + 2;
    await sheetsUpdateRange(`Users!C${rowNumber}:D${rowNumber}`, [[folderId, folderLink]]);
  }

  return { folderId, folderLink };
}

async function ensureTripFolder(accessToken: string, tripId: string, tripTitle: string, userFolderId: string) {
  const tripsRes = await sheetsGet(TRIPS_RANGE);
  const rows: string[][] = tripsRes.values ?? [];

  let rowIndex = -1;
  let folderId = "";
  let folderLink = "";

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (r[0] === tripId) {
      rowIndex = i;
      folderId = r[6] || "";
      folderLink = r[7] || "";
      break;
    }
  }

  if (rowIndex === -1) throw new Error(`Trip not found: ${tripId}`);

  if (!folderId) {
    const created = await driveCreateFolder(accessToken, tripTitle ? `${tripTitle} [${tripId}]` : `trip_${tripId}`, userFolderId);
    folderId = created.id;
    folderLink = created.webViewLink || "";

    try { await driveEnsureParent(accessToken, folderId, userFolderId); } catch (e) { console.warn("ensureParent(create)", e); }

    const rowNumber = rowIndex + 2;
    await sheetsUpdateRange(`Trips!G${rowNumber}:H${rowNumber}`, [[folderId, folderLink]]);
  } else {
    try { await driveEnsureParent(accessToken, folderId, userFolderId); } catch (e) { console.warn("ensureParent(existing)", e); }
  }

  return { folderId, folderLink };
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const accessToken =
    (session as any).accessToken ||
    (session as any)?.user?.accessToken ||
    (session as any)?.user?.token ||
    null;

  if (!accessToken) return NextResponse.json({ error: "Missing OAuth access token in session." }, { status: 401 });

  const uploaderUserId =
    ((session as any)?.userId as string | undefined) ||
    ((session?.user as any)?.email as string | undefined) ||
    "";
  const uploaderName = ((session?.user as any)?.name as string | undefined) || uploaderUserId.split("@")[0];

  const form = await req.formData();
  const tripId = String(form.get("tripId") || form.get("trip_id") || "");
  if (!tripId) return NextResponse.json({ error: "Missing tripId" }, { status: 400 });

  const files = form.getAll("file").filter(Boolean) as File[];
  if (!files.length) return NextResponse.json({ error: "Missing file" }, { status: 400 });

  const titleFromForm = (form.get("title") as string) || "";
  const explicitCategory = ((form.get("category") as string) || "").toLowerCase();
  const explicitVisibility = ((form.get("media_visibility") as string) || "").toLowerCase();

  const rootFolderId = process.env.DRIVE_UPLOAD_FOLDER_ID || process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID || "";
  if (!rootFolderId) {
    return NextResponse.json({ error: "Hiányzik a DRIVE_UPLOAD_FOLDER_ID (vagy GOOGLE_DRIVE_ROOT_FOLDER_ID) ENV." }, { status: 500 });
  }

  // ---- Trip beolvasása + TULAJDONOS-ELLENŐRZÉS ----
  const tripsRes = await sheetsGet(TRIPS_RANGE);
  const tripRows: string[][] = tripsRes.values ?? [];
  let tripTitle = "";
  let tripOwnerEmail = "";

  for (const r of tripRows) {
    if (r[0] === tripId) {
      tripTitle = r[1] || "";
      tripOwnerEmail = (r[5] || "").toLowerCase(); // 6. oszlop: owner e-mail
      break;
    }
  }

  if (!tripTitle) {
    return NextResponse.json({ error: `Trip not found: ${tripId}` }, { status: 404 });
  }

  // *** CSAK A TULAJ TÖLTHET FEL ***
  if (!tripOwnerEmail || tripOwnerEmail !== uploaderUserId.toLowerCase()) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  // ---- /TULAJDONOS-ELLENŐRZÉS ----

  // User mappa → Trip mappa (kényszerített szülővel)
  const { folderId: userFolderId } = await ensureUserFolder(accessToken, uploaderUserId.toLowerCase(), uploaderName, rootFolderId);
  const { folderId: tripFolderId } = await ensureTripFolder(accessToken, tripId, tripTitle, userFolderId);

  // 3-image/trip limit
  const mediaRes = await sheetsGet(MEDIA_RANGE);
  const mediaRows: string[][] = mediaRes.values ?? [];
  const existingImagesCount = mediaRows.filter((r) => r[1] === tripId && !r[12] && (r[13] || "").toLowerCase() === "image").length;
  const selectedImageCount = files.filter((f) => (explicitCategory || (f.type || "").toLowerCase().startsWith("image/") ? "image" : "document") === "image").length;
  if (existingImagesCount + selectedImageCount > 3) {
    const remaining = Math.max(0, 3 - existingImagesCount);
    return NextResponse.json({ error: `A képek száma elérné a limitet (3/trip). Már van ${existingImagesCount}, most ${selectedImageCount}-et jelöltél ki. Még ${remaining} tölthető.` }, { status: 422 });
  }

  // Upload + (publicnál) anyone-reader + Media sor
  const nowIso = new Date().toISOString();
  const results: any[] = [];

  for (const file of files) {
    const mime = (file.type || "").toLowerCase();
    const category = (explicitCategory || (mime.startsWith("image/") ? "image" : "document")) as "image" | "document";
    const media_visibility = (explicitVisibility || (category === "document" ? "private" : "public")) as "public" | "private";

    const uploaded = await driveUploadFile(accessToken, file, titleFromForm || file.name, tripFolderId);

    if (media_visibility === "public") {
      try { await driveSetAnyoneReader(accessToken, uploaded.id); } catch (e) { console.warn("Drive public perm fail:", e); }
    }

    const meta = await driveGetFileMeta(accessToken, uploaded.id);

    const id = `${tripId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const row: string[] = [
      id, tripId, "file",
      titleFromForm || meta.name || file.name || "",
      uploaded.id,
      meta.mimeType || file.type || "",
      meta.webViewLink || "",
      meta.webContentLink || "",
      meta.thumbnailLink || "",
      String(meta.size ?? file.size ?? ""),
      nowIso,
      uploaderUserId,
      "",
      category,
      media_visibility,
    ];
    await sheetsAppend(MEDIA_RANGE, row);

    results.push({ id, drive_file_id: uploaded.id, title: row[3], mimeType: row[5], category, media_visibility });
  }

  return NextResponse.json({ ok: true, items: results });
}
