import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sheetsGet } from "@/lib/sheets";

// Trips: 0 id | 1 title | 2 start | 3 end | 4 destination | 5 owner | 6 drive_folder_id | 7 drive_folder_link | 8 visibility
const TRIPS_RANGE = "Trips!A2:I";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function GET(_req: NextRequest) {
  const session: any = await getServerSession(authOptions);
  const me = (session?.user?.email || "").toLowerCase();

  const { values } = await sheetsGet(TRIPS_RANGE);
  const rows = values ?? [];

  const trips = rows.map((r: any[]) => ({
    id: String(r[0] || ""),
    title: String(r[1] || ""),
    start_date: String(r[2] || ""),
    end_date: String(r[3] || ""),
    destination: String(r[4] || ""),
    owner_user_id: String(r[5] || ""),
    drive_folder_link: String(r[7] || ""),
    visibility: (String(r[8] || "public").toLowerCase() as "public" | "private"),
  })).filter(t => {
    if (!t.id) return false;
    // csak publikus, vagy a saját privátja
    return t.visibility === "public" || (me && me === t.owner_user_id.toLowerCase());
  });

  // legfrissebb elöl (start_date desc)
  trips.sort((a, b) => (b.start_date || "").localeCompare(a.start_date || ""));

  return NextResponse.json(trips);
}
