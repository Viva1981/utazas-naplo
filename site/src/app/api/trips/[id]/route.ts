import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sheetsFindRowBy, sheetsUpdateRange } from "@/lib/sheets";

// Trips oszlopok (A..I):
// 0 id | 1 title | 2 start_date | 3 end_date | 4 destination
// 5 owner_user_id | 6 drive_folder_id | 7 drive_folder_link | 8 visibility
const TRIPS_RANGE = "Trips!A2:I";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session: any = await getServerSession(authOptions);
    const email = (session?.user?.email || "").toLowerCase();
    if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await context.params;

    const { index, row } = await sheetsFindRowBy(TRIPS_RANGE, (r) => (r?.[0] || "") === id);
    if (index < 0 || !row) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    const owner = String(row[5] || "").toLowerCase();
    if (owner !== email) {
      return NextResponse.json({ error: "Not allowed" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const updated = [...row];

    if (typeof body.title === "string") updated[1] = body.title;
    if (typeof body.start_date === "string") updated[2] = body.start_date;
    if (typeof body.end_date === "string") updated[3] = body.end_date;
    if (typeof body.destination === "string") updated[4] = body.destination;

    if (typeof body.visibility === "string") {
      const v = body.visibility.toLowerCase();
      updated[8] = v === "public" ? "public" : "private";
    }

    const a1 = `Trips!A${2 + index}:I${2 + index}`;
    await sheetsUpdateRange(a1, [updated]);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("/api/trips/[id] PATCH error:", e?.message || e);
    return NextResponse.json({ error: "Patch error" }, { status: 500 });
  }
}
