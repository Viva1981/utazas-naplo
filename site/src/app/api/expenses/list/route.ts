// site/src/app/api/expenses/list/route.ts  (TELJES CSERE)

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sheetsGet } from "@/lib/sheets";

const TRIPS_SHEET = "Trips!A2:I";     // id | title | start | end | destination | owner | folderId | folderLink | visibility
const EXPENSES_SHEET = "Expenses!A2:H"; // id | trip_id | date | category | description | amount | currency | payment_method

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const trip_id = (searchParams.get("trip_id") || "").trim();
  if (!trip_id) {
    return NextResponse.json({ error: "Missing trip_id" }, { status: 400 });
  }

  // ---- Jogosultság ellenőrzés ----
  // Beolvassuk a Trip sort és megnézzük a láthatóságot + tulajt.
  const { values: tripRows } = await sheetsGet(TRIPS_SHEET);
  const rows = (tripRows ?? []) as string[][];

  const norm = (s?: string) => (s ?? "").trim().toLowerCase();
  const t = rows.find((r) => norm(r?.[0]) === norm(trip_id));
  if (!t) {
    return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  }

  const owner_user_id = t[5] || "";     // 0:id, 5:owner e-mail
  const visibility = (t[8] || "private").toLowerCase() as "public" | "private";

  if (visibility !== "public") {
    const session = await getServerSession(authOptions);
    const me =
      (((session as any)?.userId as string | undefined) ||
        ((session?.user as any)?.email as string | undefined) ||
        ""
      ).toLowerCase();

    const isOwner = !!me && norm(owner_user_id) === me;
    if (!isOwner) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  // ---- Költések listázása (csak ekkor) ----
  const { values } = await sheetsGet(EXPENSES_SHEET);
  const items = (values ?? [])
    .filter((r) => r[1] === trip_id)
    .map((r) => ({
      id: r[0],
      trip_id: r[1],
      date: r[2],
      category: r[3],
      description: r[4],
      amount: Number(r[5] || 0),
      currency: r[6],
      payment_method: r[7],
    }));

  // (opcionális) privát tripnél no-store; publikusnál is simán lehet no-store
  return NextResponse.json({ items }, { headers: { "Cache-Control": "no-store" } });
}
