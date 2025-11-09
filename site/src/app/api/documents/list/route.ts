import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sheetsGet } from "@/lib/sheets";

const TRIPS_RANGE = "Trips!A2:I";        // id..visibility, owner B=1.. F=5, I=8
const DOCS_RANGE  = "Documents!A2:M";    // id..doc_visibility

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tripId = (searchParams.get("trip_id") || "").trim();

  if (!tripId) {
    return NextResponse.json({ error: "missing trip_id" }, {
      status: 400,
      headers: { "Cache-Control": "no-store" },
    });
  }

  // 1) Session (nem kötelező)
  let viewerEmail = "";
  try {
    const session: any = await getServerSession(authOptions);
    viewerEmail = (session?.user?.email || "").toLowerCase();
  } catch {
    // no-op → public mód
  }

  // 2) Trip owner megállapítása — HA sikerül. Ha nem, nem áll meg a logika.
  let isOwner = false;
  try {
    const tRes = await sheetsGet(TRIPS_RANGE);
    const tRows = tRes.values ?? [];
    const tRow = tRows.find((r: any[]) => String(r?.[0] ?? "").trim() === tripId);
    if (tRow) {
      const ownerEmail = String(tRow?.[5] ?? "").toLowerCase();
      isOwner = !!viewerEmail && !!ownerEmail && viewerEmail === ownerEmail;
      // (Ha a trip privát és NEM owner a néző → a dokumentumokból majd úgyis csak a public megy vissza.
      //  Itt NEM adunk 404-et, hogy publikus nézet PWA-ban is működjön.)
    }
  } catch (e) {
    // Ha a Trips olvasás elhasalt, akkor is próbáljuk kiszolgálni a publikus doksikat.
    console.warn("documents/list: trips lookup failed, fallback to public-only mode");
  }

  try {
    // 3) Documents olvasás
    const dRes = await sheetsGet(DOCS_RANGE);
    const dRows = dRes.values ?? [];

    const all = dRows
      .filter((r: any[]) => String(r?.[1] ?? "").trim() === tripId) // B: trip_id
      .filter((r: any[]) => !String(r?.[11] ?? "").trim())          // L: archived_at empty
      .map((r: any[]) => ({
        id: String(r?.[0] ?? ""),              // A
        trip_id: String(r?.[1] ?? ""),         // B
        title: String(r?.[2] ?? ""),           // C
        drive_file_id: String(r?.[3] ?? ""),   // D
        mimeType: String(r?.[4] ?? "") || String(r?.mime ?? ""),
        webViewLink: String(r?.[5] ?? ""),     // F
        webContentLink: String(r?.[6] ?? ""),  // G
        thumbnailLink: String(r?.[7] ?? ""),   // H
        size: String(r?.[8] ?? ""),            // I
        created_at: String(r?.[9] ?? ""),      // J
        uploader_user_id: String(r?.[10] ?? ""), // K
        archived_at: String(r?.[11] ?? ""),    // L
        doc_visibility: (String(r?.[12] ?? "private").toLowerCase() === "public"
          ? "public" : "private") as "public" | "private", // M
      }));

    // 4) Láthatóság szűrés
    const visible = isOwner ? all : all.filter(d => d.doc_visibility === "public");

    return NextResponse.json(visible, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e: any) {
    console.error("/api/documents/list error:", e?.message || e);
    // Hiba esetén is inkább ne legyen 500 „szomorú fej” — de itt tényleg nem tudtunk olvasni.
    return NextResponse.json({ error: "documents_list_error" }, {
      status: 500,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
