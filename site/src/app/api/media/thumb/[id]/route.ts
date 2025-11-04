import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/media/thumb/[id]?w=1600
 * Drive thumbnail proxy a mobil/Safari kompatibilitásért.
 * - w: szélesség (alap: 1600)
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const wRaw = req.nextUrl.searchParams.get("w") || "1600";
  const w = Math.max(32, Math.min(4096, parseInt(wRaw, 10) || 1600));

  const target = `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w${w}`;

  try {
    const resp = await fetch(target, {
      // fontos: néha hasznos lehet a no-referrer
      // headers: { Referer: "" },
    });

    if (!resp.ok) {
      // Fallback: próbáljuk a view végpontot (HTML-t adhat, de lightboxban jó eséllyel rendben lesz)
      return NextResponse.redirect(`https://drive.google.com/uc?export=view&id=${encodeURIComponent(id)}`, {
        status: 302,
        headers: { "Cache-Control": "no-store" },
      });
    }

    const buf = await resp.arrayBuffer();
    const ct = resp.headers.get("content-type") || "image/jpeg";

    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": ct,
        "Cache-Control": "private, max-age=300", // 5 perc kliens cache
      },
    });
  } catch (e) {
    return NextResponse.redirect(`https://drive.google.com/uc?export=view&id=${encodeURIComponent(id)}`, {
      status: 302,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
