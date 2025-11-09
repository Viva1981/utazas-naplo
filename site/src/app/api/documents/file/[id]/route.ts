import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sheetsFindRowBy, sheetsGet } from "@/lib/sheets";

const DOCS_RANGE  = "Documents!A2:M"; // 0..12 (id..doc_visibility)
const TRIPS_RANGE = "Trips!A2:I";     // owner e-mail index 5

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
  // Letöltési végpont első helyen (stabil stream), sheet-linkek fallbacknek
  return [
    { url: `https://drive.google.com/uc?id=${id}&export=download`, forceMime: mime || "application/octet-stream" },
    webContent ? { url: webContent, forceMime: mime || "application/octet-stream" } : null,
    webView    ? { url: webView,    forceMime: mime || "application/octet-stream" } : null,
  ].filter(Boolean) as { url: string; forceMime?: string }[];
}

async function tryFetchWithTimeout(url: string, ms: number) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { redirect: "follow", signal: ctrl.signal });
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

  const { row } = await sheetsFindRowBy(DOCS_RANGE, r => (r?.[0] || "") === id);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404, headers: { "Cache-Control": JSON_CACHE } });

  if (String(row[11] || "")) {
    return NextResponse.json({ error: "Archived" }, { status: 410, headers: { "Cache-Control": JSON_CACHE } });
  }

  const tripId  = String(row[1] || "");
  const title   = String(row[2] || "");
  const driveId = String(row[3] || "");
  const mime    = String(row[4] || "");
  const wv      = String(row[5] || "");
  const wc      = String(row[6] || "");
  const vis     = (String(row[12] || "private").toLowerCase() as "public" | "private");

  if (!driveId) {
    return NextResponse.json({ error: "Missing drive_file_id" }, { status: 400, headers: { "Cache-Control": JSON_CACHE } });
  }

  if (vis === "private") {
    const session: any = await getServerSession(authOptions).catch(() => null);
    const email = (session?.user?.email || "").toLowerCase();
    const owner = (await getTripOwnerEmail(tripId)) || "";
    if (!email || email !== owner) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: { "Cache-Control": JSON_CACHE } });
    }
  }

  const tries = candidatesFor(driveId, mime, wv, wc);

  for (const c of tries) {
    const res = await tryFetchWithTimeout(c.url, 8000);
    if (!res || !res.ok || !res.body) continue;

    const rawCt = res.headers.get("content-type") || "";
    const ctLower = rawCt.toLowerCase();

    // ⬇️ Ha a Drive "application/octet-stream"-et ad, de mi tudjuk a MIME-ot, kényszerítsük rá.
    //     HTML-t mindig kikerüljük.
    const outType =
      (!rawCt || ctLower.startsWith("text/html"))
        ? (c.forceMime || mime || "application/octet-stream")
        : (ctLower === "application/octet-stream" && (mime || c.forceMime))
            ? (mime || c.forceMime)!
            : rawCt;

    const headers: Record<string, string> = {
      "Content-Type": outType,
      "Cache-Control": FILE_CACHE,
    };

    if (outType.startsWith("application/pdf")) {
      const safe = (title || "document").replace(/[^a-zA-Z0-9._-]+/g, "_");
      headers["Content-Disposition"] = `inline; filename="${safe}.pdf"`;
    }

    return new NextResponse(res.body, { status: 200, headers });
  }

  return NextResponse.json({ error: "Drive fetch failed" }, { status: 502, headers: { "Cache-Control": JSON_CACHE } });
}
