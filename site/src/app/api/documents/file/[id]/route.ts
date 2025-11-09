import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sheetsFindRowBy, sheetsGet } from "@/lib/sheets";

// Documents: 0 id | 1 trip_id | 2 title | 3 drive_file_id | 4 mimeType
// 5 webViewLink | 6 webContentLink | 7 thumbnailLink | 8 size
// 9 created_at | 10 uploader | 11 archived_at | 12 doc_visibility
const DOCS_RANGE  = "Documents!A2:M";
// Trips: owner email index 5
const TRIPS_RANGE = "Trips!A2:I";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const FILE_CACHE = "public, max-age=600, s-maxage=600";
const JSON_CACHE = "no-store";

async function getTripOwnerEmail(tripId: string) {
  const { values } = await sheetsGet(TRIPS_RANGE);
  const rows = values ?? [];
  const r = rows.find((x: any[]) => String(x?.[0] || "") === tripId);
  return r ? String(r[5] || "").toLowerCase() : null;
}

function candidatesFor(driveId: string, mime: string, webView: string, webContent: string) {
  const id = encodeURIComponent(driveId);
  // Próbáljuk sorban: inline view → download (octet-stream) → sheetből jövő link
  const list: { url: string; forceMime?: string }[] = [];
  if (mime?.startsWith("image/")) {
    list.push({ url: `https://drive.google.com/uc?export=view&id=${id}` });
    list.push({ url: `https://drive.google.com/uc?id=${id}&export=download`, forceMime: mime });
  } else if (mime === "application/pdf") {
    // preview HTML is mehet iframe-be, de fallbackként jó a natív PDF is
    list.push({ url: `https://drive.google.com/uc?id=${id}&export=download`, forceMime: mime });
  } else {
    list.push({ url: `https://drive.google.com/uc?id=${id}&export=download`, forceMime: mime || "application/octet-stream" });
  }
  if (webContent) list.push({ url: webContent, forceMime: mime || "application/octet-stream" });
  if (webView) list.push({ url: webView, forceMime: mime || "application/octet-stream" });
  return list;
}

async function tryFetchWithTimeout(url: string, ms: number) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { redirect: "follow", signal: ctrl.signal });
    return r;
  } catch (e) {
    console.error("documents/file fetch error:", e, "→", url);
    return null;
  } finally {
    clearTimeout(t);
  }
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400, headers: { "Cache-Control": JSON_CACHE } });
  }

  // 1) Meta a sheetből
  const { row } = await sheetsFindRowBy(DOCS_RANGE, r => (r?.[0] || "") === id);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404, headers: { "Cache-Control": JSON_CACHE } });

  // archivált?
  if (String(row[11] || "")) return NextResponse.json({ error: "Archived" }, { status: 410, headers: { "Cache-Control": JSON_CACHE } });

  const tripId = String(row[1] || "");
  const driveId = String(row[3] || "");
  const mime = String(row[4] || "");
  const webView = String(row[5] || "");
  const webContent = String(row[6] || "");
  const visibility = (String(row[12] || "private").toLowerCase() as "public" | "private");

  if (!driveId) return NextResponse.json({ error: "Missing drive_file_id" }, { status: 400, headers: { "Cache-Control": JSON_CACHE } });

  // 2) Privát doksi → csak owner
  if (visibility === "private") {
    const session: any = await getServerSession(authOptions).catch(() => null);
    const email = (session?.user?.email || "").toLowerCase();
    const owner = (await getTripOwnerEmail(tripId)) || "";
    if (!email || email !== owner) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: { "Cache-Control": JSON_CACHE } });
    }
  }

  // 3) Drive-ból STREAM (nincs redirect)
  const tries = candidatesFor(driveId, mime, webView, webContent);
  for (const c of tries) {
    const res = await tryFetchWithTimeout(c.url, 8000);
    if (!res) continue;
    if (!res.ok) continue;

    const ct = res.headers.get("content-type") || "";
    const body = res.body;
    if (!body) continue;

    // Ha ismert content-type vagy tudjuk a mimet → streameljük
    const outType =
      (ct && !ct.startsWith("text/html")) ? ct :
      (c.forceMime || mime || "application/octet-stream");

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": outType,
        "Cache-Control": FILE_CACHE,
      },
    });
  }

  return NextResponse.json({ error: "Drive fetch failed" }, { status: 502, headers: { "Cache-Control": JSON_CACHE } });
}
