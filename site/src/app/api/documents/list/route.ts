import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sheetsGet } from "@/lib/sheets";

const TRIPS_RANGE = "Trips!A2:I";        // id..visibility
const DOCS_RANGE  = "Documents!A2:M";    // id..doc_visibility

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const tripId = (searchParams.get("trip_id") || "").trim();
  if (!tripId) return NextResponse.json({ error: "Missing trip_id" }, { status: 400 });

  let viewerEmail = "";
  try {
    const session: any = await getServerSession(authOptions);
    viewerEmail = (session?.user?.email || "").toLowerCase();
  } catch {}

  try {
    // 1) Trip és láthatóság
    const tRes = await sheetsGet(TRIPS_RANGE);
    const tRows = tRes.values ?? [];
    const tRow = tRows.find((r: any[]) => String(r?.[0] ?? "").trim() === tripId);
    if (!tRow) return NextResponse.json({ error: "Trip not found" }, { status: 404 });

    const ownerEmail = String(tRow?.[5] ?? "").toLowerCase();
    const rawVis = String(tRow?.[8] ?? "").trim().toLowerCase();
    const tripVisibility = rawVis === "public" ? "public" : "private";
    const isOwner = !!viewerEmail && viewerEmail === ownerEmail;

    if (tripVisibility === "private" && !isOwner) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // 2) Documents olvasás
    const dRes = await sheetsGet(DOCS_RANGE);
    const dRows = dRes.values ?? [];

    const all = dRows
      .filter((r: any[]) => String(r?.[1] ?? "").trim() === tripId) // trip_id
      .filter((r: any[]) => !String(r?.[11] ?? "").trim())          // archived_at üres (L)
      .map((r: any[]) => ({
        id: String(r?.[0] ?? ""),              // A
        trip_id: String(r?.[1] ?? ""),         // B
        title: String(r?.[2] ?? ""),           // C
        drive_file_id: String(r?.[3] ?? ""),   // D
        mimeType: String(r?.[4] ?? ""),        // E
        webViewLink: String(r?.[5] ?? ""),     // F
        webContentLink: String(r?.[6] ?? ""),  // G
        thumbnailLink: String(r?.[7] ?? ""),   // H
        size: String(r?.[8] ?? ""),            // I
        created_at: String(r?.[9] ?? ""),      // J
        uploader_user_id: String(r?.[10] ?? ""), // K
        archived_at: String(r?.[11] ?? ""),    // L
        doc_visibility: (String(r?.[12] ?? "private").toLowerCase() === "public" ? "public" : "private") as "public" | "private", // M
      }));

    if (isOwner) {
      return NextResponse.json(all, { status: 200 });
    }

    // nem owner → csak public doksi
    const visible = all.filter((d) => d.doc_visibility === "public");
    return NextResponse.json(visible, { status: 200 });
  } catch (e: any) {
    console.error("/api/documents/list error:", e?.message || e);
    return NextResponse.json({ error: "Documents list error" }, { status: 500 });
  }
}
