import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getTripById, getDocumentsByTripId } from "@/lib/data";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ tripId: string }> }
) {
  // Next 16: params Promise – ki kell várni
  const { tripId } = await context.params;

  // Szerveroldali session (nem kötelező, de ha van, owner mindent lát)
  let session: any = null;
  try {
    session = await getServerSession(authOptions);
  } catch {
    // no-op
  }
  const userEmail = session?.user?.email?.toLowerCase() ?? null;

  const trip = await getTripById(tripId);
  if (!trip) return new NextResponse("Trip not found", { status: 404 });

  const ownerEmail = (trip.owner_user_id as string | undefined)?.toLowerCase() ?? null;
  const isOwner = !!userEmail && !!ownerEmail && userEmail === ownerEmail;

  const allDocs = await getDocumentsByTripId(tripId);
  const visibleDocs = isOwner
    ? allDocs
    : allDocs.filter((d: any) => d.visibility === "public");

  return NextResponse.json({
    ok: true,
    documents: visibleDocs.map((d: any) => ({
      id: d.id,
      trip_id: d.trip_id,
      owner_user_id: d.owner_user_id,
      filename: d.filename,
      url: d.url,
      mime: d.mime,
      visibility: d.visibility as "public" | "private",
      created_at: d.created_at,
    })),
  });
}
