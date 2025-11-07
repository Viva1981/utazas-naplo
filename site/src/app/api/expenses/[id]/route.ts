import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sheetsFindRowBy, sheetsUpdateRange, sheetsGet } from "@/lib/sheets";

// Expenses oszlopok (A..I):
// 0 id | 1 trip_id | 2 date | 3 category | 4 description | 5 amount
// 6 currency | 7 payment_method | 8 archived_at
const EXP_RANGE  = "Expenses!A2:I";
const TRIPS_RANGE = "Trips!A2:I"; // 0 id | ... | 5 owner_user_id | ...

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

function nowISO() { return new Date().toISOString(); }

async function getTripOwnerEmail(tripId: string): Promise<string | null> {
  const { values } = await sheetsGet(TRIPS_RANGE);
  const rows = values ?? [];
  const r = rows.find((x: any[]) => String(x?.[0] ?? "").trim() === tripId);
  if (!r) return null;
  return String(r[5] ?? "").toLowerCase();
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session: any = await getServerSession(authOptions);
    const email = (session?.user?.email || "").toLowerCase();
    if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await context.params;
    const { index, row } = await sheetsFindRowBy(EXP_RANGE, (r) => (r?.[0] || "") === id);
    if (index < 0 || !row) return NextResponse.json({ error: "Expense not found" }, { status: 404 });

    // archivált? -> nem szerkeszthető
    const archived_at = String(row[8] ?? "");
    if (archived_at) return NextResponse.json({ error: "Already archived" }, { status: 409 });

    // owner check
    const tripId = String(row[1] ?? "");
    const owner = (await getTripOwnerEmail(tripId)) || "";
    if (!owner || owner !== email) return NextResponse.json({ error: "Not allowed" }, { status: 403 });

    const body = await req.json().catch(() => ({}));

    // engedett mezők
    const next = [...row];
    if (typeof body.date === "string") next[2] = body.date;
    if (typeof body.category === "string") next[3] = body.category;
    if (typeof body.description === "string") next[4] = body.description;
    if (typeof body.amount !== "undefined") next[5] = Number(body.amount);
    if (typeof body.currency === "string") next[6] = body.currency;
    if (typeof body.payment_method === "string") next[7] = body.payment_method;

    const a1 = `Expenses!A${2 + index}:I${2 + index}`;
    await sheetsUpdateRange(a1, [next]);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("/api/expenses/[id] PATCH error:", e?.message || e);
    return NextResponse.json({ error: "Patch error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session: any = await getServerSession(authOptions);
    const email = (session?.user?.email || "").toLowerCase();
    if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await context.params;
    const { index, row } = await sheetsFindRowBy(EXP_RANGE, (r) => (r?.[0] || "") === id);
    if (index < 0 || !row) return NextResponse.json({ error: "Expense not found" }, { status: 404 });

    // már archivált?
    const archived_at = String(row[8] ?? "");
    if (archived_at) return NextResponse.json({ ok: true, already: true });

    // owner check
    const tripId = String(row[1] ?? "");
    const owner = (await getTripOwnerEmail(tripId)) || "";
    if (!owner || owner !== email) return NextResponse.json({ error: "Not allowed" }, { status: 403 });

    const next = [...row];
    next[8] = nowISO(); // soft delete

    const a1 = `Expenses!A${2 + index}:I${2 + index}`;
    await sheetsUpdateRange(a1, [next]);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("/api/expenses/[id] DELETE error:", e?.message || e);
    return NextResponse.json({ error: "Delete error" }, { status: 500 });
  }
}
