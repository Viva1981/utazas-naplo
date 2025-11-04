import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth"; // nálad EZ a valós export
import { getTripById, getDocumentsByTripId } from "@/lib/data";

export async function GET(
  req: Request,
  { params }: { params: { tripId: string } }
) {
  // Szerveroldali session lekérés
  let session: any = null;
  try {
    session = await getServerSession(authOptions);
  } catch {
    // ha nincs session, az is ok – ilyenkor csak publikus doksikat adunk vissza
  }

  const userEmail = session?.user?.email?.toLowerCase() ?? null;
  const tripId = params.tripId;

  // 1) Trip meta (owner ellenőrzés)
  const trip = await getTripById(tripId);
  if (!trip) return new NextResponse("Trip not found", { status: 404 });

  // Nálad az owner_user_id e-mailnek tűnik (a trip oldali összehasonlításból ítélve)
  const ownerEmail = (trip.owner_user_id as string | undefined)?.toLowerCase() ?? null;
  const isOwner = !!userEmail && !!ownerEmail && userEmail === ownerEmail;

  // 2) Dokumentumok lekérés
  const allDocs = await getDocumentsByTripId(tripId);

  // 3) Szűrés: a tulaj mindent lát; más csak a publikusat
  const visibleDocs = isOwner
    ? allDocs
    : allDocs.filter((d: any) => d.visibility === "public");

  // 4) Válasz
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
