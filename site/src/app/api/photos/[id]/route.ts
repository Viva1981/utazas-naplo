import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sheetsFindRowBy, sheetsUpdateRange, sheetsGet } from "@/lib/sheets";

// Photos sheet oszlopok (A..L):
// 0 id | 1 trip_id | 2 title | 3 drive_file_id | 4 mimeType | 5 webViewLink
// 6 webContentLink | 7 thumbnailLink | 8 size | 9 created_at | 10 uploader_user_id
// 11 archived_at
const PHOTOS_RANGE = "Photos!A2:L";
const TRIPS_RANGE  = "Trips!A2:I";

function nowISO() { return new Date().toISOString(); }

async function getTripOwnerEmail(tripId: string): Promise<string | null> {
  const { values } = await sheetsGet(TRIPS_RANGE);
  const rows = values ?? [];
  const r = rows.find((x: any[]) => String(x?.[0] ?? "").trim() === tripId);
  if (!r) return null;
  return String(r[5] ?? "").toLowerCase();
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session: any = await getServerSession(authOptions);
    const email = (session?.user?.email || "").toLowerCase();
    if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const title = typeof body?.title === "string" ? body.title : undefined;

    if (title === undefined) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    const { index, row } = await sheetsFindRowBy(PHOTOS_RANGE, (r) => (r?.[0] || "") === params.id);
    if (index < 0 || !row) {
      return NextResponse.json({ error: "Photo not found" }, { status: 404 });
    }

    // archivált? -> nem módosítható
    const archived_at = String(row[11] ?? "");
    if (archived_at) {
      return NextResponse.json({ error: "Already archived" }, { status: 409 });
    }

    // owner check
    const tripId = String(row[1] ?? "");
    const owner = (await getTripOwnerEmail(tripId)) || "";
    if (!owner || owner !== email) {
      return NextResponse.json({ error: "Not allowed" }, { status: 403 });
    }

    const updated = [...row];
    updated[2] = title;

    const a1 = `Photos!A${2 + index}:L${2 + index}`;
    await sheetsUpdateRange(a1, [updated]);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("/api/photos/[id] PATCH error:", e?.message || e);
    return NextResponse.json({ error: "Patch error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session: any = await getServerSession(authOptions);
    const email = (session?.user?.email || "").toLowerCase();
    if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { index, row } = await sheetsFindRowBy(PHOTOS_RANGE, (r) => (r?.[0] || "") === params.id);
    if (index < 0 || !row) {
      return NextResponse.json({ error: "Photo not found" }, { status: 404 });
    }

    // már archivált?
    const archived_at = String(row[11] ?? "");
    if (archived_at) {
      return NextResponse.json({ ok: true, already: true });
    }

    // owner check
    const tripId = String(row[1] ?? "");
    const owner = (await getTripOwnerEmail(tripId)) || "";
    if (!owner || owner !== email) {
      return NextResponse.json({ error: "Not allowed" }, { status: 403 });
    }

    // soft delete
    const updated = [...row];
    updated[11] = nowISO();

    const a1 = `Photos!A${2 + index}:L${2 + index}`;
    await sheetsUpdateRange(a1, [updated]);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("/api/photos/[id] DELETE error:", e?.message || e);
    return NextResponse.json({ error: "Delete error" }, { status: 500 });
  }
}
