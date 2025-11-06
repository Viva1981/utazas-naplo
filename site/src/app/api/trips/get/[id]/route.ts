import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sheetsGet } from "@/lib/sheets";

const TRIPS_RANGE = "Trips!A2:I";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id?: string }> }
) {
  const p = await ctx.params;
  const wanted = (p?.id ?? "").trim();
  if (!wanted) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  // (Ha privát utaknál szűrnél tulaj szerint, innen megvan a session)
  try {
    await getServerSession(authOptions);
  } catch {
    /* no-op */
  }

  try {
    const { values } = await sheetsGet(TRIPS_RANGE);
    const rows = values ?? [];
    const row = rows.find((r) => String(r?.[0] ?? "").trim() === wanted);

    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const trip = {
      id: String(row[0] ?? ""),
      title: String(row[1] ?? ""),
      start_date: String(row[2] ?? ""),
      end_date: String(row[3] ?? ""),
      destination: String(row[4] ?? ""),
      owner_user_id: String(row[5] ?? ""),
      drive_folder_id: String(row[6] ?? ""),
      drive_folder_link: String(row[7] ?? ""),
      visibility: (String(row[8] ?? "public") as "public" | "private"),
    };

    return NextResponse.json(trip, { status: 200 });
  } catch (e: any) {
    console.error("/api/trips/get/[id] error:", e?.message || e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

