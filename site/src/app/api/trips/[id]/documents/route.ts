import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getTripById, getDocumentsByTripId } from "@/lib/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

/**
 * GET /api/trips/[id]/documents
 * - Next 15/16: ctx.params Promise lehet → await kell
 * - Átmeneti kompat: elfogadjuk az { id } és { tripId } nevű slugot is
 */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id?: string; tripId?: string }> }
) {
  const p = await ctx.params;
  const tripId = (p.id ?? p.tripId ?? "").trim();

  if (!tripId) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  // Szerveroldali session (ha van, owner mindent lát)
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

  const allDocs = (await getDocumentsByTripId(tripId)) ?? [];
  const visibleDocs = isOwner
    ? allDocs
    : allDocs.filter((d: any) => (d.visibility ?? d.media_visibility ?? "public") === "public");

  return NextResponse.json({
    ok: true,
    documents: visibleDocs.map((d: any) => ({
      id: d.id,
      trip_id: d.trip_id,
      owner_user_id: d.owner_user_id,
      filename: d.filename,
      url: d.url,
      mime: d.mime || d.mimeType || "",
      visibility: (d.visibility ?? d.media_visibility ?? "public") as "public" | "private",
      created_at: d.created_at,
    })),
  });
}
