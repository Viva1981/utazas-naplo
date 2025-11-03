import { NextResponse } from "next/server";
import { sheetsGet } from "@/lib/sheets";

const TRIPS_SHEET = "Trips!A2:I"; // id | title | start | end | destination | owner | folderId | folderLink | visibility

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> } // <<< params Promise
) {
  // params várakoztatása
  const { id } = await ctx.params;
  const wanted = (id || "").trim();
  const norm = (s?: string) => (s ?? "").trim().toLowerCase();

  try {
    // { range, values }
    const { values } = await sheetsGet(TRIPS_SHEET);
    const rows: string[][] = values ?? [];

    const row = rows.find(r => norm(r?.[0]) === norm(wanted));
    if (!row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const [
      tripId,
      title,
      start_date,
      end_date,
      destination,
      owner_user_id,
      drive_folder_id,
      drive_folder_link,
      visibility,
    ] = row;

    return NextResponse.json({
      id: tripId,
      title,
      start_date,
      end_date,
      destination,
      owner_user_id,     // kliens oldali jogosultság ellenőrzéshez
      drive_folder_id,
      drive_folder_link,
      visibility: visibility || "private",
    });
  } catch (err: any) {
    console.error("Trip get error:", err);
    return NextResponse.json(
      { error: "Internal error", detail: String(err) },
      { status: 500 }
    );
  }
}
