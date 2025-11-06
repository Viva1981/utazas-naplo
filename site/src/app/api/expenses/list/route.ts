import { NextResponse } from "next/server";
import { sheetsGet } from "@/lib/sheets";

const EXPENSES_RANGE = "Expenses!A2:H";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const tripId = (searchParams.get("trip_id") || "").trim();

  try {
    const { values } = await sheetsGet(EXPENSES_RANGE);
    const rows = values ?? [];

    const all = rows
      .filter((r: any[]) => (r?.[0] ?? "").toString().trim() !== "")
      .map((r: any[]) => ({
        id: String(r?.[0] ?? ""),
        trip_id: String(r?.[1] ?? ""),
        date: String(r?.[2] ?? ""),
        category: String(r?.[3] ?? ""),
        description: String(r?.[4] ?? ""),
        amount: Number(r?.[5] ?? 0),
        currency: String(r?.[6] ?? "HUF"),
        payment_method: String(r?.[7] ?? ""),
      }));

    const filtered = tripId ? all.filter((e) => e.trip_id === tripId) : all;

    return NextResponse.json(filtered, { status: 200 });
  } catch (e: any) {
    console.error("/api/expenses/list error:", e?.message || e);
    return NextResponse.json({ error: "Expenses list error" }, { status: 500 });
  }
}
