// site/src/lib/drive.ts

const DRIVE_API  = "https://www.googleapis.com/drive/v3";
const UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";

/**
 * Mappa létrehozása adott parent alatt
 */
export async function driveCreateFolder(accessToken: string, name: string, parentFolderId: string) {
  console.log("DRIVE create folder →", { name, parentFolderId });

  const resp = await fetch(`${DRIVE_API}/files`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentFolderId],
    }),
  });

  if (!resp.ok) {
    const txt = await resp.text().catch(() => "<no body>");
    console.error("DRIVE create folder FAILED", { status: resp.status, body: txt });
    throw new Error(`driveCreateFolder failed: ${resp.status} ${txt}`);
  }

  const folder = await resp.json().catch(() => ({} as any));
  console.log("DRIVE create folder OK", folder);

  // meta (webViewLink) lekérése
  const metaResp = await fetch(`${DRIVE_API}/files/${folder.id}?fields=id,name,webViewLink`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!metaResp.ok) {
    const txt = await metaResp.text().catch(() => "<no body>");
    console.error("DRIVE get meta FAILED", { status: metaResp.status, body: txt });
    throw new Error(`drive meta failed: ${metaResp.status} ${txt}`);
  }

  const meta = await metaResp.json().catch(() => ({} as any));
  console.log("DRIVE meta OK", meta);

  return { id: folder.id as string, webViewLink: meta.webViewLink as string };
}

/**
 * Fájl feltöltése (multipart) a megadott parent mappába
 */
export async function driveUploadFile(
  accessToken: string,
  file: Blob,
  filename: string,
  parentFolderId: string,
) {
  const metadata = {
    name: filename,
    parents: [parentFolderId],
  };

  const form = new FormData();
  form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
  form.append("file", file);

  const resp = await fetch(`${UPLOAD_API}/files?uploadType=multipart`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: form,
  });

  if (!resp.ok) {
    const txt = await resp.text().catch(() => "<no body>");
    console.error("DRIVE upload FAILED", { status: resp.status, body: txt });
    throw new Error(`driveUploadFile failed: ${resp.status} ${txt}`);
  }

  return (await resp.json()) as { id: string };
}

/**
 * Fájl metaadatainak lekérése (ikon/thumbnail/links miatt)
 */
export async function driveGetFileMeta(accessToken: string, fileId: string) {
  const fields = [
    "id",
    "name",
    "mimeType",
    "size",
    "webViewLink",
    "webContentLink",
    "thumbnailLink",
  ].join(",");

  const resp = await fetch(`${DRIVE_API}/files/${fileId}?fields=${fields}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!resp.ok) {
    const txt = await resp.text().catch(() => "<no body>");
    console.error("DRIVE meta FAILED", { status: resp.status, body: txt });
    throw new Error(`driveGetFileMeta failed: ${resp.status} ${txt}`);
  }

  return resp.json() as Promise<{
    id: string;
    name: string;
    mimeType?: string;
    size?: string;
    webViewLink?: string;
    webContentLink?: string;
    thumbnailLink?: string;
  }>;
}
export async function driveDeleteFile(accessToken: string, fileId: string) {
  const url = `${DRIVE_API}/files/${fileId}?supportsAllDrives=true`;
  const resp = await fetch(url, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!resp.ok) {
    const txt = await resp.text().catch(() => "<no body>");
    console.error("DRIVE delete FAILED", { status: resp.status, body: txt });
    throw new Error(`driveDeleteFile failed: ${resp.status} ${txt}`);
  }
  return true;
}
export async function driveSetAnyoneReader(accessToken: string, fileId: string) {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}/permissions?supportsAllDrives=true&fields=id`;
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      role: "reader",
      type: "anyone",
      allowFileDiscovery: false,
    }),
  });
  if (!resp.ok) {
    const txt = await resp.text().catch(() => "<no body>");
    console.error("DRIVE set anyone reader FAILED", { status: resp.status, body: txt });
    throw new Error(`driveSetAnyoneReader failed: ${resp.status} ${txt}`);
  }
  return true;
}
// Szülő mappák lekérése
export async function driveGetParents(accessToken: string, fileId: string) {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?fields=parents&supportsAllDrives=true`;
  const resp = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!resp.ok) {
    const txt = await resp.text().catch(() => "<no body>");
    console.error("DRIVE get parents FAILED", { status: resp.status, body: txt });
    throw new Error(`driveGetParents failed: ${resp.status} ${txt}`);
  }
  const j = (await resp.json()) as { parents?: string[] };
  return j.parents ?? [];
}

// Biztosítsuk, hogy a fájl/mappa a kívánt parentben legyen (ha nem, átrakjuk)
export async function driveEnsureParent(
  accessToken: string,
  fileId: string,
  targetParentId: string
) {
  const parents = await driveGetParents(accessToken, fileId);
  if (parents.includes(targetParentId)) return true;

  const removeParents = parents.join(",");
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?addParents=${encodeURIComponent(
    targetParentId
  )}${removeParents ? `&removeParents=${encodeURIComponent(removeParents)}` : ""}&supportsAllDrives=true&fields=id,parents`;

  const resp = await fetch(url, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!resp.ok) {
    const txt = await resp.text().catch(() => "<no body>");
    console.error("DRIVE ensure parent FAILED", { status: resp.status, body: txt });
    throw new Error(`driveEnsureParent failed: ${resp.status} ${txt}`);
  }
  return true;
}
