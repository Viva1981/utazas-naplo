import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sheetsGet } from "@/lib/sheets";

const TRIPS_RANGE = "Trips!A2:I"; // id..visibility

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

type TripRow = any[];

export async function GET() {
  // bejelentkezett felhasználó emailje (ha van)
  let viewerEmail = "";
  try {
    const session: any = await getServerSession(authOptions);
    viewerEmail = (session?.user?.email || "").toLowerCase();
  } catch {
    /* no-op */
  }

  try {
    const { values } = await sheetsGet(TRIPS_RANGE);
    const rows: TripRow[] = values ?? [];

    const all = rows
      .filter((r) => String(r?.[0] ?? "").trim() !== "") // legyen id
      .map((r) => {
        const id = String(r?.[0] ?? "");
        const title = String(r?.[1] ?? "");
        const start_date = String(r?.[2] ?? "");
        const end_date = String(r?.[3] ?? "");
        const destination = String(r?.[4] ?? "");
        const owner_user_id = String(r?.[5] ?? "");
        const drive_folder_id = String(r?.[6] ?? "");
        const drive_folder_link = String(r?.[7] ?? "");
        const rawVis = String(r?.[8] ?? "").trim().toLowerCase();
        const visibility = (rawVis === "public" ? "public" : "private") as "public" | "private";
        return {
          id,
          title,
          start_date,
          end_date,
          destination,
          owner_user_id,
          drive_folder_id,
          drive_folder_link,
          visibility,
        };
      });

    // láthatósági szűrés
    const visible = all.filter((t) => {
      if (t.visibility === "public") return true;
      // private → csak az owner lássa
      return !!viewerEmail && t.owner_user_id.toLowerCase() === viewerEmail;
    });

    return NextResponse.json(visible, { status: 200 });
  } catch (e: any) {
    console.error("/api/trips error:", e?.message || e);
    return NextResponse.json({ error: "Trips API error" }, { status: 500 });
  }
}

