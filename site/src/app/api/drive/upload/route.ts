import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sheetsAppend, sheetsGet } from "@/lib/sheets";

const TRIPS_RANGE = "Trips!A2:I"; // trip lookup
const PHOTOS_A1  = "Photos!A1";
const DOCS_A1    = "Documents!A1";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

// ===== utilok =====
const nowISO = () => new Date().toISOString();
const genId  = (p: string) => `${p}_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;

async function getTripById(tripId: string) {
  const { values } = await sheetsGet(TRIPS_RANGE);
  const rows = values ?? [];
  const r = rows.find((x: any[]) => String(x?.[0] ?? "").trim() === tripId);
  if (!r) return null;
  return {
    id: String(r[0] ?? ""),
    title: String(r[1] ?? ""),
    owner: String(r[5] ?? "").toLowerCase(),
    drive_folder_id: String(r[6] ?? ""),
    visibility: (String(r[8] ?? "").trim().toLowerCase() === "public" ? "public" : "private") as "public"|"private",
  };
}

async function googleJsonOrThrow(res: Response, hint: string) {
  if (res.ok) return res.json();
  const text = await res.text().catch(() => "");
  throw new Error(`${hint} :: ${res.status} ${res.statusText} :: ${text}`);
}

/**
 * Photos / Documents almappa biztosítása.
 * - Megkeresi a foldert a parent alatt; ha nincs, létrehozza.
 * - Ha valamiért nem sikerül ID-t visszakapni, fallback: parentId-t ad vissza,
 *   így legalább a Trip mappába megy a feltöltés (nem esik hasra az egész).
 */
async function ensureSubfolder(
  accessToken: string,
  parentId: string,
  name: "Photos" | "Documents"
): Promise<string> {
  if (!parentId) {
    // nincs trip mappa: töltsünk a Drive rootba (fájl létrejön, sheet frissül)
    return "";
  }

  // 1) keresés
  const q = `name='${name}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`;
  const listURL = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)`;
  const listRes = await fetch(listURL, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (listRes.ok) {
    const data = await listRes.json().catch(() => ({} as any));
    const found = Array.isArray(data.files) ? data.files[0] : null;
    if (found?.id) return String(found.id);
  } else {
    // nem kritikus – megyünk tovább a létrehozással
    console.warn("ensureSubfolder list failed:", await listRes.text().catch(()=>""));
  }

  // 2) létrehozás
  const createRes = await fetch("https://www.googleapis.com/drive/v3/files", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
    }),
  });

  if (createRes.ok) {
    const j = await createRes.json().catch(() => ({} as any));
    if (j?.id) return String(j.id);
    console.warn("ensureSubfolder create ok but no id in response:", j);
    return parentId; // fallback
  } else {
    console.warn("ensureSubfolder create failed:", await createRes.text().catch(()=>""));
    return parentId; // fallback
  }
}

async function uploadToDriveMultipart(
  accessToken: string,
  parentId: string, // lehet "" → root
  file: File
): Promise<{ id: string; webViewLink?: string; thumbnailLink?: string }> {
  const metadata: any = { name: file.name };
  if (parentId) metadata.parents = [parentId];

  const boundary = "BOUNDARY-" + Math.random().toString(36).slice(2);
  const enc = new TextEncoder();

  const metaPart = enc.encode(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`
  );
  const fileBuf = new Uint8Array(await file.arrayBuffer());
  const filePartHdr = enc.encode(
    `--${boundary}\r\nContent-Type: ${file.type || "application/octet-stream"}\r\n\r\n`
  );
  const end = enc.encode(`\r\n--${boundary}--`);

  const body = new Blob([metaPart, filePartHdr, fileBuf, end]);

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
    throw new Error(`Drive upload error :: ${res.status} ${res.statusText} :: ${txt}`);
  }
  return res.json();
}

// ====== fő handler ======
export async function POST(req: NextRequest) {
  try {
    const session: any = await getServerSession(authOptions);
    const accessToken: string = session?.accessToken || "";
    const email = (session?.user?.email || "").toLowerCase();

    if (!accessToken || !email) {
      return NextResponse.json({ error: "Unauthorized (no session / accessToken)" }, { status: 401 });
    }

    const form = await req.formData();
    const tripId     = String(form.get("tripId") || "").trim();
    const category   = String(form.get("category") || "").trim().toLowerCase(); // "image" | "document"
    const sheetHint  = String(form.get("sheet") || "").trim();                  // "Photos" | "Documents" (nem kötelező)
    const title      = String(form.get("title") || "");
    const docVisRaw  = String(form.get("doc_visibility") || "private").toLowerCase();
    const docVis     = docVisRaw === "public" ? "public" : "private";

    if (!tripId)    return NextResponse.json({ error: "Missing tripId" }, { status: 400 });
    if (!["image","document"].includes(category)) {
      return NextResponse.json({ error: `Invalid category '${category}'` }, { status: 400 });
    }

    const trip = await getTripById(tripId);
    if (!trip) return NextResponse.json({ error: "Trip not found" }, { status: 404 });

    // csak tulaj tölthet
    if (email !== trip.owner) {
      return NextResponse.json({ error: "Not allowed (only trip owner can upload)" }, { status: 403 });
    }

    const files = form.getAll("file").filter((v) => v instanceof File) as File[];
    if (files.length === 0) {
      return NextResponse.json({ error: "No files in form 'file'" }, { status: 400 });
    }

    // cél almappa (ha a tripnek nincs mappa-id-je, a rootba megy – de beírjuk a sheetet akkor is)
    const subName: "Photos" | "Documents" =
      sheetHint === "Photos" || (category === "image" && sheetHint !== "Documents")
        ? "Photos"
        : "Documents";

    const targetParentId = await ensureSubfolder(accessToken, trip.drive_folder_id, subName);

    const results: Array<{ok: boolean; kind: "photo"|"document"; id?: string; drive_file_id?: string; error?: string}> = [];

    for (const file of files) {
      try {
        const uploaded = await uploadToDriveMultipart(accessToken, targetParentId, file);

        if (subName === "Photos") {
          const row = [
            genId("PHOTO"),                       // A id
            tripId,                               // B trip_id
            title || file.name,                   // C title
            uploaded.id,                          // D drive_file_id
            file.type || "image/jpeg",            // E mimeType
            uploaded.webViewLink || "",           // F webViewLink
            `https://drive.google.com/uc?id=${uploaded.id}&export=download`, // G webContentLink
            uploaded.thumbnailLink || "",         // H thumbnailLink
            String(file.size || ""),              // I size
            nowISO(),                             // J created_at
            email,                                // K uploader_user_id
            "",                                   // L archived_at
          ];
          await sheetsAppend(PHOTOS_A1, row);
          results.push({ ok: true, kind: "photo", id: row[0], drive_file_id: uploaded.id });
        } else {
          const row = [
            genId("DOC"),                         // A id
            tripId,                               // B trip_id
            title || file.name,                   // C title
            uploaded.id,                          // D drive_file_id
            file.type || "application/octet-stream", // E mimeType
            uploaded.webViewLink || "",           // F webViewLink
            `https://drive.google.com/uc?id=${uploaded.id}&export=download`, // G webContentLink
            uploaded.thumbnailLink || "",         // H thumbnailLink
            String(file.size || ""),              // I size
            nowISO(),                             // J created_at
            email,                                // K uploader_user_id
            "",                                   // L archived_at
            docVis,                               // M doc_visibility
          ];
          await sheetsAppend(DOCS_A1, row);
          results.push({ ok: true, kind: "document", id: row[0], drive_file_id: uploaded.id });
        }
      } catch (e: any) {
        console.error("upload item failed:", e?.message || e);
        results.push({ ok: false, kind: subName === "Photos" ? "photo" : "document", error: String(e?.message || e) });
      }
    }

    // ha minden darab bukott, 500; ha vegyes, 207 Multi-Status helyett 200 + részletes eredmények
    const allFailed = results.length > 0 && results.every(r => !r.ok);
    return NextResponse.json({ ok: !allFailed, items: results }, { status: allFailed ? 500 : 200 });

  } catch (e: any) {
    console.error("/api/drive/upload fatal:", e?.message || e);
    return NextResponse.json({ error: "Upload fatal error", detail: String(e?.message || e) }, { status: 500 });
  }
}
