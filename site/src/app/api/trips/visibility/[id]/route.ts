import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sheetsFindRowBy, sheetsUpdateRange } from "@/lib/sheets";

const TRIPS_RANGE = "Trips!A2:I";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const me =
    ((session as any)?.userId as string | undefined) ||
    ((session?.user as any)?.email as string | undefined) ||
    "";
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const visibilityRaw = String(body.visibility || "").toLowerCase();
  const visibility = visibilityRaw === "public" ? "public" : "private";

  const { index, row } = await sheetsFindRowBy(TRIPS_RANGE, (r) => (r?.[0] || "") === id);
  if (index < 0 || !row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const owner = (row[5] || "").toLowerCase();
  if (!owner || owner !== me.toLowerCase()) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // I oszlop az index 8
  const updated = [...row];
  while (updated.length < 9) updated.push("");
  updated[8] = visibility;

  const a1 = `Trips!A${2 + index}:I${2 + index}`;
  await sheetsUpdateRange(a1, [updated]);

  return NextResponse.json({ ok: true, visibility });
}
