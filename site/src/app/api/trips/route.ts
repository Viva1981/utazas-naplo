import { NextResponse } from "next/server";
import { sheetsGet } from "@/lib/sheets";

const TRIPS_RANGE = "Trips!A2:I"; // a megadott oszloprendhez

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function GET() {
  try {
    const { values } = await sheetsGet(TRIPS_RANGE);
    const rows = values ?? [];

    const list = rows
      .filter((r: any[]) => (r?.[0] ?? "").toString().trim() !== "") // legyen id
      .map((r: any[]) => ({
        id: String(r?.[0] ?? ""),
        title: String(r?.[1] ?? ""),
        start_date: String(r?.[2] ?? ""),
        end_date: String(r?.[3] ?? ""),
        destination: String(r?.[4] ?? ""),
        owner_user_id: String(r?.[5] ?? ""),
        drive_folder_id: String(r?.[6] ?? ""),
        drive_folder_link: String(r?.[7] ?? ""),
        visibility: (String(r?.[8] ?? "public") as "public" | "private"),
      }));

    // Ha szeretnéd: csak publikusak
    // const list = all.filter(t => t.visibility !== "private");

    return NextResponse.json(list, { status: 200 });
  } catch (e: any) {
    console.error("/api/trips error:", e?.message || e);
    return NextResponse.json({ error: "Trips API error" }, { status: 500 });
  }
}
