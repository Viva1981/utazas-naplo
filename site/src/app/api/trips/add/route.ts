import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sheetsAppend } from "@/lib/sheets";
import { driveCreateFolder } from "@/lib/drive";

const TRIPS_HEADER_A1 = "Trips!A1:I1"; // id | title | start | end | dest | owner | folderId | folderLink | visibility
const ROOT_FOLDER_ID = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID!;

export async function POST(req: Request) {
  // 1) Auth
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const accessToken = (session as any).accessToken as string | undefined;
  const ownerUserId =
    ((session as any)?.userId as string | undefined) ||
    ((session?.user as any)?.email as string | undefined) ||
    "";
  if (!accessToken || !ownerUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2) Body
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }

  const title = String(body.title || "").trim();
  const destination = String(body.destination || "").trim();
  const start_date = String(body.start_date || "");
  const end_date = String(body.end_date || "");
  const visibilityRaw = String(body.visibility || "").toLowerCase();
  const visibility: "public" | "private" =
    visibilityRaw === "public" ? "public" : "private";

  if (!title || !destination || !start_date || !end_date) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  // 3) Szülő mappa (user mappa, ha van a sessionben)
  const userFolderId =
    ((session as any).userFolderId as string | undefined) || ROOT_FOLDER_ID;

  // 4) Új trip azonosító + Drive mappa létrehozás
  const id = `TRIP_${Date.now()}`;
  const folderName = `${title} • ${start_date} → ${end_date}`;
  let tripFolderId = "";
  let tripFolderLink = "";

  try {
    const folder = await driveCreateFolder(accessToken, folderName, userFolderId);
    tripFolderId = folder.id;
    tripFolderLink = folder.webViewLink || "";
  } catch (e: any) {
    console.error("driveCreateFolder failed:", e?.message || e);
    return NextResponse.json({ error: "Drive folder create failed" }, { status: 502 });
  }

  // 5) Append a Trips sheetre
  try {
    await sheetsAppend(TRIPS_HEADER_A1, [
      id,
      title,
      start_date,
      end_date,
      destination,
      ownerUserId,     // F
      tripFolderId,    // G
      tripFolderLink,  // H
      visibility,      // I
    ]);
  } catch (e: any) {
    console.error("sheetsAppend Trips failed:", e?.message || e);
    return NextResponse.json({ error: "Sheets append failed" }, { status: 500 });
  }

  // 6) OK válasz
  return NextResponse.json({
    ok: true,
    id,
    owner_user_id: ownerUserId,
    drive_folder_id: tripFolderId,
    drive_folder_link: tripFolderLink,
    visibility,
  });
}
