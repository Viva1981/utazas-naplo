import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sheetsGet } from "@/lib/sheets";

const TRIPS_SHEET = "Trips!A2:I"; // id | title | start | end | destination | owner | folderId | folderLink | visibility

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const wanted = (id || "").trim();
  const norm = (s?: string) => (s ?? "").trim().toLowerCase();

  try {
    const { values } = await sheetsGet(TRIPS_SHEET);
    const rows: string[][] = values ?? [];

    const row = rows.find((r) => norm(r?.[0]) === norm(wanted));
    if (!row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const [
      tripId,
      title,
      start_date,
      end_date,
      destination,
      owner_user_id,
      drive_folder_id,
      drive_folder_link,
      visibility,
    ] = row;

    const tripVisibility = (visibility || "private").toLowerCase() as
      | "public"
      | "private";

    // Ha privát, csak a tulaj láthatja
    if (tripVisibility !== "public") {
      const session = await getServerSession(authOptions);
      const me =
        (((session as any)?.userId as string | undefined) ||
          ((session?.user as any)?.email as string | undefined) ||
          ""
        ).toLowerCase();

      const isOwner =
        !!me && (owner_user_id || "").toLowerCase() === me;

      if (!isOwner) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    return NextResponse.json({
      id: tripId,
      title,
      start_date,
      end_date,
      destination,
      owner_user_id,
      drive_folder_id,
      drive_folder_link,
      visibility: tripVisibility,
    });
  } catch (err: any) {
    console.error("Trip get error:", err);
    return NextResponse.json(
      { error: "Internal error", detail: String(err) },
      { status: 500 }
    );
  }
}
