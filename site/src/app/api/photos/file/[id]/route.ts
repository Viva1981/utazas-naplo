import { NextRequest, NextResponse } from "next/server";
import { sheetsFindRowBy } from "@/lib/sheets";

/**
 * Photos sheet oszlopsorrend (A2:L):
 * 0:id 1:trip_id 2:title 3:drive_file_id 4:mimeType 5:webViewLink 6:webContentLink
 * 7:thumbnailLink 8:size 9:created_at 10:uploader_user_id 11:archived_at
 */
const PHOTOS_RANGE = "Photos!A2:L";

// Ne cache-eljük agresszívan a HTML oldalt, de a képet lehet röviden
const IMG_CACHE = "public, max-age=600, s-maxage=600";
const JSON_CACHE = "no-store";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  // Next 16: params Promise
  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "missing id" }, { status: 400, headers: { "Cache-Control": JSON_CACHE } });
  }

  // 1) Meta lekérése a Google Sheetből
  let row: string[] | null = null;
  try {
    const { row: r } = await sheetsFindRowBy(PHOTOS_RANGE, (one) => (one[0] || "") === id);
    row = r || null;
  } catch (e) {
    console.error("photos/file sheetsFindRowBy error:", e);
    return NextResponse.json({ error: "sheet lookup failed" }, { status: 500, headers: { "Cache-Control": JSON_CACHE } });
  }

  if (!row) {
    return NextResponse.json({ error: "photo not found" }, { status: 404, headers: { "Cache-Control": JSON_CACHE } });
  }

  const driveId = row[3];
  const mimeFromSheet = row[4] || "image/jpeg";
  const webContentLink = row[6]; // uc?id=...&export=download (többnyire)
  if (!driveId) {
    return NextResponse.json({ error: "missing drive_file_id" }, { status: 404, headers: { "Cache-Control": JSON_CACHE } });
  }

  // 2) Jelöltek a letöltéshez / inline megjelenítéshez
  const candidates: { url: string; forceMime?: string }[] = [
    { url: `https://drive.google.com/uc?export=view&id=${encodeURIComponent(driveId)}` }, // inline megjelenítés
    { url: `https://drive.google.com/uc?id=${encodeURIComponent(driveId)}&export=download`, forceMime: mimeFromSheet }, // gyakran octet-stream → felülírjuk
  ];
  if (webContentLink) {
    candidates.push({ url: webContentLink, forceMime: mimeFromSheet });
  }

  // 3) Sorban megpróbáljuk a forrásokat, és 200-zal STREAMELÜNK
  for (const c of candidates) {
    const res = await tryFetchWithTimeout(c.url, 8000);
    if (!res) continue;                 // timeout / network
    if (!res.ok) continue;              // 4xx/5xx → próbáljuk a következőt
    const ct = res.headers.get("content-type") || "";
    const body = res.body;

    if (!body) continue;

    // Ha képtípus, visszaadjuk natívan
    if (ct.startsWith("image/")) {
      return new NextResponse(body, {
        status: 200,
        headers: {
          "Content-Type": ct,
          "Cache-Control": IMG_CACHE,
        },
      });
    }

    // Ha nem image (pl. application/octet-stream vagy text/html),
    // de mi tudjuk a képtípust, akkor felülírjuk és így is streameljük.
    if (c.forceMime && c.forceMime.startsWith("image/")) {
      return new NextResponse(body, {
        status: 200,
        headers: {
          "Content-Type": c.forceMime,
          "Cache-Control": IMG_CACHE,
        },
      });
    }

    // Egyébként nem jó jelölt → megyünk tovább
  }

  return NextResponse.json({ error: "Drive fetch failed" }, { status: 502, headers: { "Cache-Control": JSON_CACHE } });
}

/** fetch timeout-tal, hogy ne „várjunk örökké” */
async function tryFetchWithTimeout(url: string, ms: number) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { redirect: "follow", signal: ctrl.signal });
    return r;
  } catch (e) {
    console.error("drive fetch error:", e, "→", url);
    return null;
  } finally {
    clearTimeout(t);
  }
}
