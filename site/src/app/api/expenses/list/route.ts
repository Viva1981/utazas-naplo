import { NextResponse } from "next/server";
import { sheetsGet } from "@/lib/sheets";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const trip_id = searchParams.get("trip_id") || "";
  const { values } = await sheetsGet("Expenses!A2:H");
  const items = (values ?? [])
    .filter(r => r[1] === trip_id)
    .map(r => ({
      id: r[0], trip_id: r[1], date: r[2], category: r[3],
      description: r[4], amount: Number(r[5] || 0), currency: r[6], payment_method: r[7]
    }));
  return NextResponse.json({ items });
}
