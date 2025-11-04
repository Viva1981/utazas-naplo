import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sheetsGet, sheetsAppend, sheetsUpdateRange } from "@/lib/sheets";
import {
  driveCreateFolder,
  driveEnsureParent,
} from "@/lib/drive";

/**
 * Users sheet (A..F):
 * A:user_id | B:email | C:display_name | D:drive_user_folder_id | E:drive_user_folder_link | F:role
 */
const USERS_RANGE = "Users!A2:F";

/**
 * Trips sheet (A..I):
 * A:id | B:title | C:start_date | D:end_date | E:destination | F:owner_user_id | G:drive_folder_id | H:drive_folder_link | I:visibility
 */
const TRIPS_RANGE = "Trips!A2:I";

export const runtime = "nodejs";

/** Segéd: gondoskodunk a user soráról + user mappáról (role='user') */
async function ensureUserFolder(
  accessToken: string,
  userId: string,      // pl. email
  email: string,
  displayName: string,
  rootFolderId: string
) {
  // 1) Olvassuk a Users sheetet
  const users = await sheetsGet(USERS_RANGE);
  const rows: string[][] = users.values ?? [];

  let idx = -1;
  let folderId = "";
  let folderLink = "";
  let role = "";

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const rid = (r[0] || r[1] || "").toLowerCase(); // A:user_id vagy B:email (rugalmasság)
    if (rid && (rid === userId.toLowerCase() || rid === email.toLowerCase())) {
      idx = i;
      folderId = r[3] || "";       // D
      folderLink = r[4] || "";     // E
      role = (r[5] || "").toLowerCase(); // F
      break;
    }
  }

  // 2) Ha nincs sor → felvesszük role='user'-rel és létrehozzuk a user mappát
  if (idx === -1) {
    const folder = await driveCreateFolder(accessToken, displayName || email || userId, rootFolderId);
    folderId = folder.id;
    folderLink = folder.webViewLink || "";
    role = "user";

    await sheetsAppend(USERS_RANGE, [
      userId,          // A user_id
      email,           // B email
      displayName,     // C display_name
      folderId,        // D drive_user_folder_id
      folderLink,      // E drive_user_folder_link
      role,            // F role
    ]);

    return { folderId, folderLink };
  }

  // 3) Van sor, de nincs mappa → létrehozzuk és beírjuk
  if (!folderId) {
    const folder = await driveCreateFolder(accessToken, displayName || email || userId, rootFolderId);
    folderId = folder.id;
    folderLink = folder.webViewLink || "";
    const rowNum = idx + 2;
    await sheetsUpdateRange(`Users!D${rowNum}:F${rowNum}`, [[folderId, folderLink, role || "user"]]);
  } else if (!role) {
    // ha mappa van, de role üres → töltsük fel 'user'-re
    const rowNum = idx + 2;
    await sheetsUpdateRange(`Users!F${rowNum}:F${rowNum}`, [["user"]]);
  }

  return { folderId, folderLink };
}

/** Segéd: trip mappa biztosítása a user mappa ALATT */
async function createTripFolderUnderUser(
  accessToken: string,
  tripId: string,
  tripTitle: string,
  userFolderId: string
) {
  // készítünk egy érthető nevű mappát (pl. "Zakopane [TRIP_1234]")
  const name = tripTitle ? `${tripTitle} [${tripId}]` : `trip_${tripId}`;
  const folder = await driveCreateFolder(accessToken, name, userFolderId);

  // biztos, ami biztos: ha a Drive megtréfál, kényszerítsük a parentet
  try {
    await driveEnsureParent(accessToken, folder.id, userFolderId);
  } catch (e) {
    console.warn("ensureParent(trip) warning:", e);
  }

  return { id: folder.id, link: folder.webViewLink || "" };
}

/**
 * POST /api/trips/add
 * body: { title, start_date, end_date, destination, visibility? }
 * - létrehozza (vagy biztosítja) a user mappát (Users sheet + Drive)
 * - létrehozza a trip mappát a user mappa alatt
 * - rögzíti a Trips sorban a G/H oszlopokba a mappa ID/linket
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const accessToken =
    (session as any).accessToken ||
    (session as any)?.user?.accessToken ||
    (session as any)?.user?.token ||
    null;
  if (!accessToken) return NextResponse.json({ error: "Missing OAuth token" }, { status: 401 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const title = String(body?.title || "").trim();
  const start_date = String(body?.start_date || "");
  const end_date = String(body?.end_date || "");
  const destination = String(body?.destination || "");
  const visibility = (String(body?.visibility || "private").toLowerCase() === "public" ? "public" : "private");

  if (!title) return NextResponse.json({ error: "Missing title" }, { status: 400 });

  // user azonosítók
  const email = ((session?.user as any)?.email as string) || "";
  const userId = (((session as any)?.userId as string) || email || "").toLowerCase();
  const displayName = ((session?.user as any)?.name as string) || (email.split("@")[0] || userId);

  // gyökér mappa ENV
  const rootFolderId = process.env.DRIVE_UPLOAD_FOLDER_ID || process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID || "";
  if (!rootFolderId) {
    return NextResponse.json({ error: "Missing DRIVE_UPLOAD_FOLDER_ID (or GOOGLE_DRIVE_ROOT_FOLDER_ID)" }, { status: 500 });
  }

  // 1) Gondoskodjunk a user mappáról (Users sheet + Drive, role='user')
  const { folderId: userFolderId } = await ensureUserFolder(
    accessToken,
    userId,
    email,
    displayName,
    rootFolderId
  );

  // 2) Trip ID
  const tripId = `TRIP_${Date.now()}`;

  // 3) Trip mappa létrehozása a user mappa alatt
  const tripFolder = await createTripFolderUnderUser(accessToken, tripId, title, userFolderId);

  // 4) Trips sor felvétele (G/H = trip mappa)
  const row = [
    tripId,          // A id
    title,           // B title
    start_date,      // C
    end_date,        // D
    destination,     // E
    email,           // F owner_user_id
    tripFolder.id,   // G drive_folder_id
    tripFolder.link, // H drive_folder_link
    visibility,      // I visibility
  ];
  await sheetsAppend(TRIPS_RANGE, row);

  return NextResponse.json({
    ok: true,
    trip: {
      id: tripId,
      title,
      start_date,
      end_date,
      destination,
      owner_user_id: email,
      drive_folder_id: tripFolder.id,
      drive_folder_link: tripFolder.link,
      visibility,
    },
  });
}
