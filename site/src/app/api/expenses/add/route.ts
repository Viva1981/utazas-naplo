import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sheetsAppend, sheetsFindRowBy } from "@/lib/sheets";

// Trips:  id | title | start_date | end_date | destination | owner_user_id | drive_folder_id | drive_folder_link
const TRIPS_RANGE = "Trips!A2:H";
// Expenses: id | trip_id | date | category | description | amount | currency | payment_method | created_at
const EXPENSES_HEADER_RANGE = "Expenses!A1:I1";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({} as any));
  const {
    trip_id = "",
    date = "",
    category = "other",
    description = "",
    amount = 0,
    currency = "HUF",
    payment_method = "card",
  } = body;

  if (!trip_id || !date || !amount) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  // bejelentkezett user azonosító (email)
  const requester =
    ((session as any).userId as string | undefined) ||
    ((session.user as any)?.email as string | undefined) ||
    "";

  // megkeressük a trippet és a tulajt
  const { index: tripIdx, row: tripRow } = await sheetsFindRowBy(
    TRIPS_RANGE,
    (r) => (r?.[0] || "") === trip_id
  );

  if (tripIdx < 0 || !tripRow) {
    return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  }

  const ownerUserId = (tripRow[5] || "").toLowerCase();
  const requesterId = requester.toLowerCase();

  if (!ownerUserId || ownerUserId !== requesterId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // minden ok → beírjuk az expense-t
  const expenseId = `EXP_${Date.now()}`;
  await sheetsAppend(EXPENSES_HEADER_RANGE, [
    expenseId,
    trip_id,
    date,
    category,
    description,
    Number(amount),
    currency,
    payment_method,
    new Date().toISOString(),
  ]);

  return NextResponse.json({ ok: true, id: expenseId });
}
