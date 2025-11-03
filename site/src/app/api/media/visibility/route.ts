import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sheetsGet, sheetsUpdate } from "@/lib/sheets";

// Media oszlopok: ... | H:category | I:media_visibility
const MEDIA_RANGE = "Media!A2:K";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { media_id, media_visibility } = await req.json();
  if (!media_id || !["public", "private"].includes(media_visibility)) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
    }

  // Olvasd be a Media sheetet, keresd meg a sor indexét media_id alapján, és írd át az I oszlopot.
  // Itt a konkrét sheetsUpdate implementációdtól függ a hívás – a lényeg:
  // - megtalálni a sor számát
  // - I oszlop cellát frissíteni új értékre
  // Példa jelleggel:
  const res = await sheetsGet(MEDIA_RANGE);
  const rows = res.values ?? [];
  let rowIndex = -1;
  for (let i = 0; i < rows.length; i++) {
    if (rows[i][0] === media_id) { rowIndex = i; break; }
  }
  if (rowIndex === -1) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Példa: sheetsUpdate("Media!I{row}:I{row}", [[media_visibility]])
  await sheetsUpdate(`Media!I${rowIndex + 2}:I${rowIndex + 2}`, [[media_visibility]]);

  return NextResponse.json({ ok: true });
}
