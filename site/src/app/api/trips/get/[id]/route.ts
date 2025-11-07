import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sheetsGet } from "@/lib/sheets";

const TRIPS_RANGE = "Trips!A2:I"; // id..visibility

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

type Trip = {
  id: string;
  title: string;
  start_date: string;
  end_date: string;
  destination: string;
  owner_user_id: string;
  drive_folder_id: string;
  drive_folder_link: string;
  visibility: "public" | "private";
};

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id?: string }> }
) {
  const p = await ctx.params;
  const wanted = (p?.id ?? "").trim();
  if (!wanted) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  // néző email (ha be van jelentkezve)
  let viewerEmail = "";
  try {
    const session: any = await getServerSession(authOptions);
    viewerEmail = (session?.user?.email || "").toLowerCase();
  } catch {
    /* no-op */
  }

  try {
    const { values } = await sheetsGet(TRIPS_RANGE);
    const rows = values ?? [];

    const row = rows.find((r: any[]) => String(r?.[0] ?? "").trim() === wanted);
    if (!row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const rawVis = String(row?.[8] ?? "").trim().toLowerCase();
    const trip: Trip = {
      id: String(row?.[0] ?? ""),
      title: String(row?.[1] ?? ""),
      start_date: String(row?.[2] ?? ""),
      end_date: String(row?.[3] ?? ""),
      destination: String(row?.[4] ?? ""),
      owner_user_id: String(row?.[5] ?? ""),
      drive_folder_id: String(row?.[6] ?? ""),
      drive_folder_link: String(row?.[7] ?? ""),
      visibility: (rawVis === "public" ? "public" : "private"),
    };

    // láthatósági ellenőrzés:
    // - public → bárki láthatja
    // - private → csak owner láthatja, másnak 404
    if (trip.visibility === "private") {
      const isOwner =
        !!viewerEmail &&
        trip.owner_user_id.toLowerCase() === viewerEmail;
      if (!isOwner) {
        // fontos: 404-et adunk, hogy ne áruljuk el a létezést
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
    }

    return NextResponse.json(trip, { status: 200 });
  } catch (e: any) {
    console.error("/api/trips/get/[id] error:", e?.message || e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
