import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sheetsGet } from "@/lib/sheets";

const MEDIA_RANGE = "Media!A2:K";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Feltételezzük, hogy formdata-ban jön: trip_id, files[], category="image"|"document", media_visibility...
  const form = await req.formData();
  const trip_id = String(form.get("trip_id") || "");
  const category = String(form.get("category") || "image").toLowerCase();

  if (!trip_id) {
    return NextResponse.json({ error: "Missing trip_id" }, { status: 400 });
  }

  if (category === "image") {
    // Max 3 image/trip (archivált nélkül)
    const mediaRes = await sheetsGet(MEDIA_RANGE);
    const rows = mediaRes.values ?? [];
    const existingImages = rows.filter(
      (r) => r[1] === trip_id && !r[6] && (r[7] || "").toLowerCase() === "image"
    );
    if (existingImages.length >= 3) {
      return NextResponse.json(
        { error: "A képek száma elérte a limitet (3/trip)." },
        { status: 422 }
      );
    }
  }

  // Itt jönne a Drive feltöltés + Sheets-be írás (append) a saját meglévő logikáddal.
  // ...
  return NextResponse.json({ ok: true });
}
