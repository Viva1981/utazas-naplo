import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sheetsAppend, sheetsGet } from "@/lib/sheets";

const TRIPS_RANGE = "Trips!A2:I"; // trip lookup
const PHOTOS_SHEET_A1 = "Photos!A1";
const DOCS_SHEET_A1   = "Documents!A1";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

// Helper: olvasd ki a tripet a Sheets-ből
async function getTripById(tripId: string) {
  const { values } = await sheetsGet(TRIPS_RANGE);
  const rows = values ?? [];
  const r = rows.find((x: any[]) => String(x?.[0] ?? "").trim() === tripId);
  if (!r) return null;
  return {
    id: String(r[0] ?? ""),
    drive_folder_id: String(r[6] ?? ""),
    owner_user_id: String(r[5] ?? ""),
    visibility: (String(r[8] ?? "").trim().toLowerCase() === "public" ? "public" : "private") as "public"|"private",
  };
}

// Helper: almappa azonosító (Photos/Documents) – ha nincs, létrehozzuk
async function ensureSubfolder(accessToken: string, parentId: string, name: "Photos" | "Documents") {
  // Próbáljuk megkeresni
  const q = encodeURIComponent(`name='${name}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`);
  const listUrl = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)`;
  const listRes = await fetch(listUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
  const listJson = listRes.ok ? await listRes.json().catch(() => ({})) : {};
  const found = Array.isArray(listJson.files) ? listJson.files[0] : null;
  if (found?.id) return found.id;

  // Létrehozás
  const meta = {
    name,
    mimeType: "application/vnd.google-apps.folder",
    parents: [parentId],
  };
  const createRes = await fetch("https://www.googleapis.com/drive/v3/files", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(meta),
  });
  const createJson = createRes.ok ? await createRes.json().catch(() => ({})) : {};
  return createJson.id as string;
}

// Helper: fájl feltöltése Drive-ra (multipart)
async function uploadToDriveMultipart(
  accessToken: string,
  parentId: string,
  file: File
) {
  const metadata = {
    name: file.name,
    parents: [parentId],
  };

  const boundary = "BOUNDARY-" + Math.random().toString(36).slice(2);
  const encoder = new TextEncoder();

  const metaPart = encoder.encode(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`
  );

  const fileArrayBuffer = await file.arrayBuffer();
  const filePartHeader = encoder.encode(
    `--${boundary}\r\nContent-Type: ${file.type || "application/octet-stream"}\r\n\r\n`
  );
  const endPart = encoder.encode(`\r\n--${boundary}--`);
  const body = new Blob([metaPart, filePartHeader, new Uint8Array(fileArrayBuffer), endPart]);

  const res = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink,thumbnailLink", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body,
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Drive upload error: ${res.status} ${txt}`);
  }
  return res.json() as Promise<{ id: string; webViewLink?: string; thumbnailLink?: string }>;
}

// Helper: mostani idő ISO
const nowISO = () => new Date().toISOString();

// Helper: ID generálás
function genId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function POST(req: NextRequest) {
  try {
    const session: any = await getServerSession(authOptions);
    const accessToken: string = session?.accessToken || "";
    const uploaderEmail: string = (session?.user?.email || "").toLowerCase();
    if (!accessToken || !uploaderEmail) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const form = await req.formData();
    const tripId = String(form.get("tripId") || "").trim();
    const category = String(form.get("category") || "").trim().toLowerCase(); // "image" | "document"
    // opcionális: Photos/Documents explicit jelölés
    const sheetHint = String(form.get("sheet") || "").trim();
    const docVisibility = String(form.get("doc_visibility") || "private").toLowerCase(); // only for Documents
    const title = String(form.get("title") || "");

    if (!tripId) return NextResponse.json({ error: "Missing tripId" }, { status: 400 });
    if (!["image", "document"].includes(category)) {
      return NextResponse.json({ error: "Invalid category" }, { status: 400 });
    }

    // Trip mappa
    const trip = await getTripById(tripId);
    if (!trip) return NextResponse.json({ error: "Trip not found" }, { status: 404 });

    // Csak owner tölthessen fel az adott tripbe (ahogy megbeszéltük)
    if (uploaderEmail !== trip.owner_user_id.toLowerCase()) {
      return NextResponse.json({ error: "Not allowed" }, { status: 403 });
    }

    // Almappa: Photos / Documents
    const subName: "Photos" | "Documents" = category === "image" ? "Photos" : "Documents";
    const parentId = trip.drive_folder_id;
    const targetFolderId = parentId ? await ensureSubfolder(accessToken, parentId, subName) : parentId;

    // Fájlok
    const files = form.getAll("file").filter((v) => v instanceof File) as File[];
    if (files.length === 0) {
      return NextResponse.json({ error: "No files" }, { status: 400 });
    }

    const results: any[] = [];
    for (const file of files) {
      const uploaded = await uploadToDriveMultipart(accessToken, targetFolderId || parentId, file);

      if (category === "image" || sheetHint === "Photos") {
        // Photos sheet: id..archived_at (A..L)
        const row = [
          genId("PHOTO"),                   // A id
          tripId,                           // B trip_id
          title || file.name,               // C title
          uploaded.id,                      // D drive_file_id
          file.type || "image/jpeg",        // E mimeType
          uploaded.webViewLink || "",       // F webViewLink
          `https://drive.google.com/uc?id=${uploaded.id}&export=download`, // G webContentLink
          uploaded.thumbnailLink || "",     // H thumbnailLink
          String(file.size || ""),          // I size
          nowISO(),                         // J created_at
          uploaderEmail,                    // K uploader_user_id
          "",                               // L archived_at
        ];
        await sheetsAppend(PHOTOS_SHEET_A1, [row]);
        results.push({ kind: "photo", id: row[0], drive_file_id: uploaded.id });
      } else {
        // Documents sheet: id..doc_visibility (A..M)
        const row = [
          genId("DOC"),                     // A id
          tripId,                           // B trip_id
          title || file.name,               // C title
          uploaded.id,                      // D drive_file_id
          file.type || "application/octet-stream", // E mimeType
          uploaded.webViewLink || "",       // F webViewLink
          `https://drive.google.com/uc?id=${uploaded.id}&export=download`, // G webContentLink
          uploaded.thumbnailLink || "",     // H thumbnailLink
          String(file.size || ""),          // I size
          nowISO(),                         // J created_at
          uploaderEmail,                    // K uploader_user_id
          "",                               // L archived_at
          docVisibility === "public" ? "public" : "private", // M doc_visibility
        ];
        await sheetsAppend(DOCS_SHEET_A1, [row]);
        results.push({ kind: "document", id: row[0], drive_file_id: uploaded.id });
      }
    }

    return NextResponse.json({ ok: true, items: results }, { status: 200 });
  } catch (e: any) {
    console.error("/api/drive/upload error:", e?.message || e);
    return NextResponse.json({ error: "Upload error" }, { status: 500 });
  }
}
