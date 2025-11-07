import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sheetsGet } from "@/lib/sheets";

const TRIPS_RANGE = "Trips!A2:I";
const MEDIA_RANGE = "Media!A2:O";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const tripId = (searchParams.get("trip_id") || "").trim();
  if (!tripId) return NextResponse.json({ error: "Missing trip_id" }, { status: 400 });

  // néző email
  let viewerEmail = "";
  try {
    const session: any = await getServerSession(authOptions);
    viewerEmail = (session?.user?.email || "").toLowerCase();
  } catch {}

  try {
    // 1) Trip beolvasás és láthatóság
    const tRes = await sheetsGet(TRIPS_RANGE);
    const tRows = tRes.values ?? [];
    const tRow = tRows.find((r: any[]) => String(r?.[0] ?? "").trim() === tripId);
    if (!tRow) return NextResponse.json({ error: "Trip not found" }, { status: 404 });

    const ownerEmail = String(tRow?.[5] ?? "").toLowerCase();
    const rawVis = String(tRow?.[8] ?? "").trim().toLowerCase();
    const tripVisibility = rawVis === "public" ? "public" : "private";
    const isOwner = !!viewerEmail && viewerEmail === ownerEmail;

    // private trip → csak owner láthatja
    if (tripVisibility === "private" && !isOwner) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // 2) Media beolvasás és szűrés
    const mRes = await sheetsGet(MEDIA_RANGE);
    const mRows = mRes.values ?? [];

    const all = mRows
      .filter((r: any[]) => String(r?.[1] ?? "").trim() === tripId) // trip_id match
      .filter((r: any[]) => !String(r?.[12] ?? "").trim()) // archived_at üres
      .map((r: any[]) => ({
        id: String(r?.[0] ?? ""),
        trip_id: String(r?.[1] ?? ""),
        type: String(r?.[2] ?? ""),
        title: String(r?.[3] ?? ""),
        drive_file_id: String(r?.[4] ?? ""),
        mimeType: String(r?.[5] ?? ""),
        webViewLink: String(r?.[6] ?? ""),
        webContentLink: String(r?.[7] ?? ""),
        thumbnailLink: String(r?.[8] ?? ""),
        size: String(r?.[9] ?? ""),
        created_at: String(r?.[10] ?? ""),
        uploader_user_id: String(r?.[11] ?? ""),
        archived_at: String(r?.[12] ?? ""),
        category: String(r?.[13] ?? ""),
        media_visibility: (String(r?.[14] ?? "private").toLowerCase() === "public" ? "public" : "private") as "public" | "private",
      }));

    if (isOwner) {
      return NextResponse.json(all, { status: 200 });
    }

    // uploader: a saját privátját is lássa
    const visible = all.filter((m) => {
      if (m.media_visibility === "public") return true;
      const uploader = (m.uploader_user_id || "").toLowerCase();
      return !!viewerEmail && uploader === viewerEmail;
    });

    return NextResponse.json(visible, { status: 200 });
  } catch (e: any) {
    console.error("/api/media/list error:", e?.message || e);
    return NextResponse.json({ error: "Media list error" }, { status: 500 });
  }
}
