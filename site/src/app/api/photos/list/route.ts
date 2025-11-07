import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sheetsGet } from "@/lib/sheets";

const TRIPS_RANGE = "Trips!A2:I";      // id..visibility
const PHOTOS_RANGE = "Photos!A2:L";    // id..archived_at

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const tripId = (searchParams.get("trip_id") || "").trim();
  if (!tripId) return NextResponse.json({ error: "Missing trip_id" }, { status: 400 });

  // néző email (ha bejelentkezett)
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

    // private trip → csak owner
    if (tripVisibility === "private" && !isOwner) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // 2) Photos olvasás
    const pRes = await sheetsGet(PHOTOS_RANGE);
    const pRows = pRes.values ?? [];

    const all = pRows
      .filter((r: any[]) => String(r?.[1] ?? "").trim() === tripId) // trip_id
      .filter((r: any[]) => !String(r?.[11] ?? "").trim())          // archived_at üres (L oszlop = index 11)
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
      }));

    // public tripen: minden fotó látható; private tripen idáig úgysem jutottunk, ha nem owner
    return NextResponse.json(all, { status: 200 });
  } catch (e: any) {
    console.error("/api/photos/list error:", e?.message || e);
    return NextResponse.json({ error: "Photos list error" }, { status: 500 });
  }
}
