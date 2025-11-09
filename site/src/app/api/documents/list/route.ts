import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getTripById, getDocumentsByTripId } from "@/lib/data";

export const dynamic = "force-dynamic";

/**
 * Visszaadja egy trip dokumentumait.
 * - Ha NINCS session: csak a publikus dokumentumokat (doc_visibility === "public")
 * - Ha VAN session és a felhasználó az owner: minden dokumentum
 * - Archivált elemek (archived_at) kiszűrve
 *
 * Kimeneti mezők a klienshez igazítva:
 * id, trip_id, title, drive_file_id, mimeType, webViewLink, webContentLink,
 * thumbnailLink, size, created_at, uploader_user_id, archived_at, doc_visibility
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tripId = searchParams.get("trip_id") || "";
    if (!tripId) {
      return NextResponse.json({ error: "missing trip_id" }, { status: 400 });
    }

    // 1) Session — nem kötelező (PWA/standalone alatt gyakran nincs)
    let email: string | null = null;
    try {
      const session = await getServerSession(authOptions);
      email = session?.user?.email
        ? String(session.user.email).toLowerCase()
        : null;
    } catch {
      // nincs session → publikus mód
    }

    // 2) Trip owner azonosítása
    const trip = await getTripById(tripId).catch(() => null as any);
    const ownerEmail = trip?.owner_user_id
      ? String(trip.owner_user_id).toLowerCase()
      : null;
    const isOwner = !!email && !!ownerEmail && email === ownerEmail;

    // 3) Dokumentumok beolvasása (lib/data)
    const all = await getDocumentsByTripId(tripId);

    // 4) Archivált kiszűrése
    const active = (Array.isArray(all) ? all : []).filter(
      (d: any) => !d.archived_at
    );

    // 5) Láthatósági szűrés
    const visible = isOwner
      ? active
      : active.filter((d: any) => (d.doc_visibility || "private") === "public");

    // 6) Kimenet egységesítése a klienshez
    const out = visible.map((d: any) => ({
      id: d.id,
      trip_id: d.trip_id,
      title: d.title || "",
      drive_file_id: d.drive_file_id,
      mimeType: d.mimeType || d.mime || "",
      webViewLink: d.webViewLink || "",
      webContentLink: d.webContentLink || "",
      thumbnailLink: d.thumbnailLink || "",
      size: d.size || "",
      created_at: d.created_at || "",
      uploader_user_id: d.uploader_user_id || "",
      archived_at: d.archived_at || "",
      doc_visibility: (d.doc_visibility || "private") as "public" | "private",
    }));

    return NextResponse.json(out, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    console.error("/api/documents/list error:", e);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
