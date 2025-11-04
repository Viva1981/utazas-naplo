import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Session-mentes Drive proxy:
 * - Alapból képként adja vissza: https://drive.google.com/uc?export=view&id=FILE_ID
 * - Ha ?mode=download, akkor letöltés:  https://drive.google.com/uc?export=download&id=FILE_ID
 * - Nem kér Sheets/NextAuth hozzáférést, ezért publikus nézőknek is működik az előnézet.
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> } // Next 14/16: params Promise
) {
  const { id: fileId } = await ctx.params;
  if (!fileId) {
    return NextResponse.json({ error: "Missing file id" }, { status: 400 });
  }

  const mode = (req.nextUrl.searchParams.get("mode") || "view").toLowerCase();
  const exportParam = mode === "download" ? "download" : "view";

  const redirectUrl = `https://drive.google.com/uc?export=${exportParam}&id=${fileId}`;

  return NextResponse.redirect(redirectUrl, {
    status: 302,
    headers: { "Cache-Control": "private, max-age=60" },
  });
}
