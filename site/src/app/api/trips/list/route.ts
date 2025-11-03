import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sheetsGet } from "@/lib/sheets";

const TRIPS_RANGE = "Trips!A2:I";

export async function GET() {
  const session = await getServerSession(authOptions);
  const me =
    ((session as any)?.userId as string | undefined) ||
    ((session?.user as any)?.email as string | undefined) ||
    "";

  const { values } = await sheetsGet(TRIPS_RANGE);
  const rows: string[][] = values ?? [];

  const items = rows
    .map((r) => ({
      id: r[0],
      title: r[1],
      start_date: r[2],
      end_date: r[3],
      destination: r[4],
      owner_user_id: r[5],
      drive_folder_id: r[6],
      drive_folder_link: r[7],
      visibility: r[8] || "private",
    }))
    .filter((t) => {
      const vis = (t.visibility || "private").toLowerCase();
      if (vis === "public") return true;
      // privát -> csak a tulaj láthatja
      return me && t.owner_user_id && me.toLowerCase() === t.owner_user_id.toLowerCase();
    });

  return NextResponse.json({ items });
}
