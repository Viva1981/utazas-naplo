import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sheetsGet } from "@/lib/sheets";

// Trips: 0 id | 1 title | 2 start | 3 end | 4 destination | 5 owner | 6 drive_folder_id | 7 drive_folder_link | 8 visibility
const TRIPS_RANGE = "Trips!A2:I";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

function overlaps(aStart: string, aEnd: string, bStart?: string, bEnd?: string) {
  if (!bStart && !bEnd) return true;
  const A1 = aStart || "";
  const A2 = aEnd || aStart || "";
  const B1 = bStart || "";
  const B2 = bEnd || bStart || "";
  return !(A2 < B1 || A1 > B2);
}

export async function GET(req: NextRequest) {
  const session: any = await getServerSession(authOptions);
  const me = (session?.user?.email || "").toLowerCase();

  const q    = (req.nextUrl.searchParams.get("q") || "").toLowerCase();
  const from = req.nextUrl.searchParams.get("from") || "";
  const to   = req.nextUrl.searchParams.get("to")   || "";
  const vis  = (req.nextUrl.searchParams.get("vis") || "all") as "all"|"public"|"private";
  const mine = req.nextUrl.searchParams.get("mine") === "1";

  const { values } = await sheetsGet(TRIPS_RANGE);
  const rows = values ?? [];

  let trips = rows.map((r: any[]) => ({
    id: String(r[0] || ""),
    title: String(r[1] || ""),
    start_date: String(r[2] || ""),
    end_date: String(r[3] || ""),
    destination: String(r[4] || ""),
    owner_user_id: String(r[5] || ""),
    visibility: (String(r[8] || "public").toLowerCase() as "public" | "private"),
  }));

  // láthatóság baseline: publikusak + a saját privátjaim
  trips = trips.filter(t => {
    const isMine = me && t.owner_user_id.toLowerCase() === me;
    return t.visibility === "public" || isMine;
  });

  // query szűrés
  if (q) {
    trips = trips.filter(t =>
      (t.title + " " + t.destination).toLowerCase().includes(q)
    );
  }

  // dátum metsztés (ha bármennyire belelóg a from–to ablakba)
  if (from || to) {
    trips = trips.filter(t => overlaps(t.start_date, t.end_date, from || undefined, to || undefined));
  }

  // vis: public/private
  if (vis !== "all") {
    trips = trips.filter(t => t.visibility === vis);
  }

  // mine: csak az enyéim
  if (mine) {
    trips = trips.filter(t => me && t.owner_user_id.toLowerCase() === me);
  }

  // legfrissebb elöl
  trips.sort((a, b) => (b.start_date || "").localeCompare(a.start_date || ""));

  return NextResponse.json(trips);
}
