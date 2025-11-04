import { NextResponse } from "next/server";
import { auth } from "@/lib/auth"; // ha máshol van az auth/session, igazítsd az útvonalat
import { getTripById, getDocumentsByTripId } from "@/lib/data"; 
// ↑ Ezeket mindjárt létrehozzuk a 1.1 pontban, ha még nincsenek

export async function GET(
  req: Request,
  { params }: { params: { tripId: string } }
) {
  const session = await auth(); // legyen benne a user id (owner vizsgálathoz)
  const userId = session?.user?.id ?? null;
  const tripId = params.tripId;

  // 1) Trip lekérés (owner ellenőrzés)
  const trip = await getTripById(tripId);
  if (!trip) return new NextResponse("Trip not found", { status: 404 });

  const isOwner = userId && trip.owner_user_id === userId;

  // 2) Dokumentumok lekérés
  const allDocs = await getDocumentsByTripId(tripId);

  // 3) Szűrés: owner mindent lát, mások csak 'public'-ot
  const visibleDocs = isOwner
    ? allDocs
    : allDocs.filter((d: any) => d.visibility === "public");

  // 4) Visszaadás
  return NextResponse.json({
    ok: true,
    documents: visibleDocs.map((d: any) => ({
      id: d.id,
      trip_id: d.trip_id,
      owner_user_id: d.owner_user_id,
      filename: d.filename,
      url: d.url,
      mime: d.mime,
      visibility: d.visibility, // "public" | "private"
      created_at: d.created_at,
    })),
  });
}
