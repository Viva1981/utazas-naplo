import { NextResponse } from "next/server";
import { sheetsGet } from "@/lib/sheets";

const TRIPS_RANGE = "Trips!A2:I";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function GET() {
  try {
    const { values } = await sheetsGet(TRIPS_RANGE);
    const rows = values ?? [];

    const items = rows
      .filter((r: any[]) => (r?.[0] ?? "").toString().trim() !== "")
      .map((r: any[]) => {
        const id = String(r?.[0] ?? "");
        const title = String(r?.[1] ?? "");
        const start = String(r?.[2] ?? ""); // YYYY-MM-DD
        const destination = String(r?.[4] ?? "");

        // egyszerű "YYYY-MM" kulcs
        const ym = start ? start.slice(0, 7) : "";
        return {
          id: `${id}:${ym || "na"}`,
          trip_id: id,
          title,
          destination,
          date: ym || (start.slice(0, 4) || ""),
        };
      });

    return NextResponse.json(items, { status: 200 });
  } catch (e: any) {
    console.error("/api/timeline error:", e?.message || e);
    return NextResponse.json({ error: "Timeline error" }, { status: 500 });
  }
}
