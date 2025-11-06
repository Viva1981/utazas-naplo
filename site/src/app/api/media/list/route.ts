import { NextResponse } from "next/server";
import { sheetsGet } from "@/lib/sheets";

const MEDIA_RANGE = "Media!A2:O";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const tripId = (searchParams.get("trip_id") || "").trim();

  try {
    const { values } = await sheetsGet(MEDIA_RANGE);
    const rows = values ?? [];

    const all = rows.map((r: any[]) => ({
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
      media_visibility: (String(r?.[14] ?? "public") as "public" | "private"),
    }));

    const filtered = tripId ? all.filter((m) => m.trip_id === tripId) : all;

    return NextResponse.json(filtered, { status: 200 });
  } catch (e: any) {
    console.error("/api/media/list error:", e?.message || e);
    return NextResponse.json({ error: "Media list error" }, { status: 500 });
  }
}
