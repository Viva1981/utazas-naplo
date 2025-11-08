import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { driveCreateFolder } from "@/lib/drive";
import { sheetsAppend } from "@/lib/sheets";

const TRIPS_A1 = "Trips!A1"; // ide appendelünk (fejléc alá)
const ROOT_FOLDER_ID =
  process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID ||
  process.env.DRIVE_UPLOAD_FOLDER_ID ||
  "";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function POST(req: NextRequest) {
  try {
    const session: any = await getServerSession(authOptions);
    const owner = session?.user?.email || "";
    if (!owner) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const title = String(body.title || "").trim();
    const destination = String(body.destination || "").trim();
    const start_date = String(body.start_date || "");
    const end_date = String(body.end_date || "");
    const visibility = (String(body.visibility || "public").toLowerCase() === "private") ? "private" : "public";

    if (!title || !destination || !start_date || !end_date) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const now = Date.now();
    const tripId = `TRIP_${now}`;

    // Opcionális Drive mappa a triphez (ha van root)
    let tripFolderId = "";
    let tripFolderLink = "";
    const accessToken = (session as any)?.accessToken || "";

    if (ROOT_FOLDER_ID && accessToken) {
      try {
        const folderName = `${title} (${start_date}→${end_date})`;
        const folder = await driveCreateFolder(accessToken, folderName, ROOT_FOLDER_ID);
        tripFolderId = folder?.id || "";
        tripFolderLink = folder?.webViewLink || "";
      } catch (e) {
        console.error("Trip folder create error:", e);
      }
    }

    // Sor hozzáfűzése a Trips sheethez
    await sheetsAppend(TRIPS_A1, [
      tripId,         // A: id
      title,          // B: title
      start_date,     // C: start_date
      end_date,       // D: end_date
      destination,    // E: destination
      owner,          // F: owner_user_id
      tripFolderId,   // G: drive_folder_id
      tripFolderLink, // H: drive_folder_link
      visibility,     // I: visibility
    ]);

    // Válasz – ha HTML kívánság (pl. natív form), redirecteljünk szép URL-re
    const wantsHtml =
      req.headers.get("accept")?.includes("text/html") ||
      req.nextUrl.searchParams.get("redirect") === "1";

    if (wantsHtml) {
      const to = new URL(`/trips/${tripId}`, req.nextUrl);
      return NextResponse.redirect(to, { status: 303 });
    }

    return NextResponse.json({
      ok: true,
      trip: {
        id: tripId,
        title,
        start_date,
        end_date,
        destination,
        owner_user_id: owner,
        drive_folder_id: tripFolderId,
        drive_folder_link: tripFolderLink,
        visibility,
      },
    });
  } catch (e: any) {
    console.error("/api/trips/add error:", e?.message || e);
    return NextResponse.json({ error: "Create trip error" }, { status: 500 });
  }
}
