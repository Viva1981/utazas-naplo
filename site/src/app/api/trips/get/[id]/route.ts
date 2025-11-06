// site/src/app/api/trips/get/[id]/route.ts  (TELJES CSERE)

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sheetsGet } from "@/lib/sheets";

const TRIPS_SHEET = "Trips!A2:I"; // id | title | start | end | destination | owner | folderId | folderLink | visibility

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> } // Next params Promise (Next 15/16 app router)
) {
  const { id } = await ctx.params;
  const wanted = (id || "").trim();
  if (!wanted) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  // csak bejelentkezve engedjük (mert Sheets/Drive token kell)
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { values } = await sheetsGet(TRIPS_SHEET);
    const rows = values ?? [];
    const idx = rows.findIndex((r) => (r?.[0] || "").trim() === wanted);
    if (idx < 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const row = rows[idx];

    // A..I: id | title | start | end | destination | owner | folderId | folderLink | visibility
    const trip = {
      id: String(row[0] || ""),
      title: String(row[1] || ""),
      start_date: String(row[2] || ""),
      end_date: String(row[3] || ""),
      destination: String(row[4] || ""),
      owner_user_id: String(row[5] || ""),
      drive_folder_id: String(row[6] || ""),
      drive_folder_link: String(row[7] || ""),
      visibility: (String(row[8] || "") as "public" | "private") || "public",
    };

    // A page.tsx ezt a Trip objektumot várja KÖZVETLENÜL (nem {trip: {...}})
    return NextResponse.json(trip, { status: 200 });
  } catch (e: any) {
    console.error("GET /api/trips/get/[id] error:", e?.message || e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
