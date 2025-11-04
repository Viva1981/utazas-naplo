import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sheetsGet, sheetsUpdateRange } from "@/lib/sheets";

// Media oszlopok: A:id ... N:category O:media_visibility
const MEDIA_RANGE_ALL = "Media!A2:O";

type MediaRow = string[];

/**
 * PATCH /api/media/visibility
 * Body: { id: string, media_visibility: "public" | "private" }
 */
export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const id = String(body?.id || "");
  const media_visibility = String(body?.media_visibility || "").toLowerCase();
  if (!id || (media_visibility !== "public" && media_visibility !== "private")) {
    return NextResponse.json({ error: "Missing or invalid fields" }, { status: 400 });
  }

  // Beolvassuk a Media sheetet és megkeressük a sort
  const res = await sheetsGet(MEDIA_RANGE_ALL);
  const rows: MediaRow[] = res.values ?? [];

  const idx = rows.findIndex((r) => (r[0] || "") === id); // A oszlop = id
  if (idx === -1) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // A táblában a sor száma (fejléc +1 miatt) = index + 2
  const sheetRow = idx + 2;

  // O oszlop = media_visibility (15. oszlop)
  const range = `Media!O${sheetRow}:O${sheetRow}`;
  await sheetsUpdateRange(range, [[media_visibility]]);

  return NextResponse.json({ ok: true });
}

// opcionálisan POST-tal is működjön ugyanígy
export const POST = PATCH;
