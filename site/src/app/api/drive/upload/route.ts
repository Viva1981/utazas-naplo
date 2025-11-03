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

/**
 * Media sheet (A..O):
 * A:id B:trip_id C:type D:title E:drive_file_id F:mimeType G:webViewLink H:webContentLink
 * I:thumbnailLink J:size K:created_at L:uploader_user_id M:archived_at N:category O:media_visibility
 */
const MEDIA_RANGE = "Media!A2:O";

/**
 * Trips sheet (A..I):
 * A:id B:title C:start D:end E:destination F:owner_user_id G:drive_folder_id H:drive_folder_link I:visibility
 */
const TRIPS_RANGE = "Trips!A2:I";

/**
 * Users sheet (A..D):
 * A:id(email) B:name C:drive_user_folder_id D:drive_user_folder_link
 */
const USERS_RANGE = "Users!A2:D";

export const runtime = "nodejs";

// -- helpers -------------------------------------------------------

async function ensureUserFolder(
  accessToken: string,
  userId: string,
  userName: string,
  rootFolderId: string
) {
  const usersRes = await sheetsGet(USERS_RANGE);
  const rows: string[][] = usersRes.values ?? [];

  let rowIndex = -1;
  let folderId = "";
  let folderLink = "";

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if ((r[0] || "").toLowerCase() === userId.toLowerCase()) {
      rowIndex = i;
      folderId = r[2] || "";
      folderLink = r[3] || "";
      break;
    }
  }

  // nincs sor → létrehozzuk a user mappát a ROOT alatt, majd felvesszük a Users sheetbe
  if (rowIndex === -1) {
    const folderName = userName ? `${userName}` : userId;
    const created = await driveCreateFolder(accessToken, folderName, rootFolderId);
    folderId = created.id;
    folderLink = created.webViewLink || "";

    await sheetsAppend(USERS_RANGE, [userId, userName || "", folderId, folderLink]);
    return { folderId, folderLink };
  }

  // van sor, de nincs mappa → létrehozzuk
  if (!folderId) {
    const folderName = userName ? `${userName}` : userId;
    const created = await driveCreateFolder(accessToken, folderName, rootFolderId);
    folderId = created.id;
    folderLink = created.webViewLink || "";

    const rowNumber = rowIndex + 2;
    await sheetsUpdateRange(`Users!C${rowNumber}:D${rowNumber}`, [[folderId, folderLink]]);
  }

  return { folderId, folderLink };
}

async function ensureTripFolder(
  accessToken: string,
  tripId: string,
  tripTitle: string,
  userFolderId: string
) {
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

  // ha nincs még trip mappa → hozzuk létre a USER mappa alatt
  if (!folderId) {
    const folderName = tripTitle ? `${tripTitle} [${tripId}]` : `trip_${tripId}`;
    const created = await driveCreateFolder(accessToken, folderName, userFolderId);
    folderId = created.id;
    folderLink = created.webViewLink || "";

    // biztos ami biztos: ha mégsem ott kötött ki, átrakjuk a userFolderId alá
    try {
      await driveEnsureParent(accessToken, folderId, userFolderId);
    } catch (e) {
      console.warn("driveEnsureParent (create) warning:", e);
    }

    const rowNumber = rowIndex + 2;
    await sheetsUpdateRange(`Trips!G${rowNumber}:H${rowNumber}`, [[folderId, folderLink]]);
  } else {
    // ha már volt mappa, garantáljuk, hogy a userFolderId a szülője
    try {
      await driveEnsureParent(accessToken, folderId, userFolderId);
    } catch (e) {
      console.warn("driveEnsureParent (existing) warning:", e);
    }
  }

  return { folderId, folderLink };
}

// -- handler -------------------------------------------------------

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Access token
  const accessToken =
    (session as any).accessToken ||
    (session as any)?.user?.accessToken ||
    (session as any)?.user?.token ||
    null;

  if (!accessToken) {
    return NextResponse.json({ error: "Missing OAuth access token in session." }, { status: 401 });
  }

  const uploaderUserId =
    ((session as any)?.userId as string | undefined) ||
    ((session?.user as any)?.email as string | undefined) ||
    "";
  const uploaderName =
    ((session?.user as any)?.name as string | undefined) || uploaderUserId.split("@")[0];

  const form = await req.formData();

  const tripId = String(form.get("tripId") || form.get("trip_id") || "");
  if (!tripId) return NextResponse.json({ error: "Missing tripId" }, { status: 400 });

  const files = form.getAll("file").filter(Boolean) as File[];
  if (!files.length) return NextResponse.json({ error: "Missing file" }, { status: 400 });

  const titleFromForm = (form.get("title") as string) || "";
  const explicitCategory = ((form.get("category") as string) || "").toLowerCase(); // "image" | "document" | ""
  const explicitVisibility = ((form.get("media_visibility") as string) || "").toLowerCase(); // "public" | "private" | ""

  // ROOT mappa env (csak user-mappa létrehozásakor kell)
  const rootFolderId =
    process.env.DRIVE_UPLOAD_FOLDER_ID || process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID || "";
  if (!rootFolderId) {
    return NextResponse.json(
      { error: "Hiányzik a DRIVE_UPLOAD_FOLDER_ID (vagy GOOGLE_DRIVE_ROOT_FOLDER_ID) ENV." },
      { status: 500 }
    );
  }

  // Trips: trip cím + owner
  const tripsRes = await sheetsGet(TRIPS_RANGE);
  const tripRows: string[][] = tripsRes.values ?? [];
  let tripTitle = "";
  for (const r of tripRows) {
    if (r[0] === tripId) {
      tripTitle = r[1] || "";
      break;
    }
  }
  if (!tripTitle) {
    return NextResponse.json({ error: `Trip not found: ${tripId}` }, { status: 404 });
  }

  // User mappa (Users sheet)
  const { folderId: userFolderId } = await ensureUserFolder(
    accessToken,
    uploaderUserId.toLowerCase(),
    uploaderName,
    rootFolderId
  );

  // Trip mappa (Trips sheet G/H) – és kényszerítjük, hogy a userFolderId legyen a szülő
  const { folderId: tripFolderId } = await ensureTripFolder(
    accessToken,
    tripId,
    tripTitle,
    userFolderId
  );

  // 3 kép/trip limit
  const mediaRes = await sheetsGet(MEDIA_RANGE);
  const mediaRows: string[][] = mediaRes.values ?? [];

  const existingImagesCount = mediaRows.filter((r) => {
    const rTripId = r[1]; // B
    const archivedAt = r[12]; // M
    const category = (r[13] || "").toLowerCase(); // N
    return rTripId === tripId && !archivedAt && category === "image";
  }).length;

  const selectedImageCount = files.filter((f) => {
    const mime = (f.type || "").toLowerCase();
    const inferred = explicitCategory
      ? explicitCategory
      : mime.startsWith("image/")
      ? "image"
      : "document";
    return inferred === "image";
  }).length;

  if (existingImagesCount + selectedImageCount > 3) {
    const remaining = Math.max(0, 3 - existingImagesCount);
    return NextResponse.json(
      {
        error: `A képek száma elérné a limitet (3/trip). Már van ${existingImagesCount}, most ${selectedImageCount}-et jelöltél ki. Még ${remaining} tölthető.`,
      },
      { status: 422 }
    );
  }

  // Feltöltések a TRIP mappába + (public esetén) anyone-reader + Media sorok
  const nowIso = new Date().toISOString();
  const results: any[] = [];

  for (const file of files) {
    const mime = (file.type || "").toLowerCase();
    const category = (explicitCategory ||
      (mime.startsWith("image/") ? "image" : "document")) as "image" | "document";
    const media_visibility = (explicitVisibility ||
      (category === "document" ? "private" : "public")) as "public" | "private";

    const uploaded = await driveUploadFile(
      accessToken,
      file,
      titleFromForm || file.name,
      tripFolderId
    );

    // ha public, adjunk "anyone, reader" jogosultságot, hogy <img> is betöltse
    if (media_visibility === "public") {
      try {
        await driveSetAnyoneReader(accessToken, uploaded.id);
      } catch (e) {
        console.warn("Drive public permission beállítás nem sikerült:", e);
      }
    }

    const meta = await driveGetFileMeta(accessToken, uploaded.id);

    const id = `${tripId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const row: string[] = [
      id, // A
      tripId, // B
      "file", // C
      titleFromForm || meta.name || file.name || "", // D
      uploaded.id, // E
      meta.mimeType || file.type || "", // F
      meta.webViewLink || "", // G
      meta.webContentLink || "", // H
      meta.thumbnailLink || "", // I
      String(meta.size ?? file.size ?? ""), // J
      nowIso, // K
      uploaderUserId, // L
      "", // M archived_at
      category, // N
      media_visibility, // O
    ];

    await sheetsAppend(MEDIA_RANGE, row);

    results.push({
      id,
      drive_file_id: uploaded.id,
      title: row[3],
      mimeType: row[5],
      category,
      media_visibility,
    });
  }

  return NextResponse.json({ ok: true, items: results });
}
