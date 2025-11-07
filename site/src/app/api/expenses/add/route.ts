import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sheetsAppend, sheetsGet } from "@/lib/sheets";

const TRIPS_RANGE     = "Trips!A2:I";
const EXPENSES_A1     = "Expenses!A1";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

function genId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function isOwnerOfTrip(tripId: string, email: string) {
  const { values } = await sheetsGet(TRIPS_RANGE);
  const rows = values ?? [];
  const r = rows.find((x: any[]) => String(x?.[0] ?? "").trim() === tripId);
  if (!r) return false;
  const owner = String(r?.[5] ?? "").toLowerCase();
  return owner === email.toLowerCase();
}

export async function POST(req: NextRequest) {
  try {
    const session: any = await getServerSession(authOptions);
    const email = (session?.user?.email || "").toLowerCase();
    if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const trip_id = String(body?.trip_id || "").trim();
    if (!trip_id) return NextResponse.json({ error: "Missing trip_id" }, { status: 400 });

    if (!(await isOwnerOfTrip(trip_id, email))) {
      return NextResponse.json({ error: "Not allowed" }, { status: 403 });
    }

    const id = genId("EXP");
    const row = [
      id,                                   // A id
      trip_id,                              // B trip_id
      String(body?.date || ""),             // C date
      String(body?.category || "other"),    // D category
      String(body?.description || ""),      // E description
      Number(body?.amount || 0),            // F amount
      String(body?.currency || "HUF"),      // G currency
      String(body?.payment_method || "card")// H payment_method
    ];

    await sheetsAppend(EXPENSES_A1, row);
    return NextResponse.json({ ok: true, id }, { status: 200 });
  } catch (e: any) {
    console.error("/api/expenses/add error:", e?.message || e);
    return NextResponse.json({ error: "Add expense error" }, { status: 500 });
  }
}
