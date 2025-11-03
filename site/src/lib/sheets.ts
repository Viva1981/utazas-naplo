// site/src/lib/sheets.ts
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const API = "https://sheets.googleapis.com/v4/spreadsheets";

// <<< Session-ből vesszük az access tokent (NextAuth v4) >>>
export async function getAccessToken(): Promise<string> {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("No session");
  const token = (session as any).accessToken as string | undefined;
  if (!token) throw new Error("No access token in session");
  return token;
}

export async function sheetsGet(rangeA1: string) {
  const accessToken = await getAccessToken();
  const spreadsheetId = process.env.GOOGLE_SHEETS_DB_SPREADSHEET_ID!;
  const url = `${API}/${spreadsheetId}/values/${encodeURIComponent(rangeA1)}`;
  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!resp.ok) {
    const txt = await resp.text().catch(() => "<no body>");
    throw new Error(`sheetsGet failed: ${resp.status} ${txt}`);
  }
  return resp.json() as Promise<{ range: string; values?: string[][] }>;
}

export async function sheetsAppend(rangeA1: string, row: any[]) {
  const accessToken = await getAccessToken();
  const spreadsheetId = process.env.GOOGLE_SHEETS_DB_SPREADSHEET_ID!;
  const url = `${API}/${spreadsheetId}/values/${encodeURIComponent(
    rangeA1
  )}:append?valueInputOption=RAW`;

  // diagnosztika
  console.log("SHEETS append →", {
    spreadsheetId,
    rangeA1,
    rowPreview: row.slice(0, 8),
  });

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ values: [row] }),
  });

  if (!resp.ok) {
    const txt = await resp.text().catch(() => "<no body>");
    console.error("SHEETS append FAILED", { status: resp.status, body: txt });
    throw new Error(`sheetsAppend failed: ${resp.status} ${txt}`);
  }

  const json = await resp.json().catch(() => ({}));
  console.log("SHEETS append OK", json);
  return json;
}

export async function sheetsUpdateRange(rangeA1: string, values: any[][]) {
  const accessToken = await getAccessToken();
  const spreadsheetId = process.env.GOOGLE_SHEETS_DB_SPREADSHEET_ID!;
  const url = `${API}/${spreadsheetId}/values/${encodeURIComponent(
    rangeA1
  )}?valueInputOption=RAW`;

  const resp = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ values }),
  });

  if (!resp.ok) {
    const txt = await resp.text().catch(() => "<no body>");
    throw new Error(`sheetsUpdateRange failed: ${resp.status} ${txt}`);
  }

  return resp.json();
}

export async function sheetsFindRowBy(
  rangeA1: string,
  predicate: (row: string[]) => boolean
) {
  console.log("SHEETS findRowBy →", { rangeA1 });
  const { values } = await sheetsGet(rangeA1);
  const rows = values ?? [];
  console.log("SHEETS findRowBy rows len:", rows.length);
  const idx = rows.findIndex((r) => predicate(r as any));
  console.log("SHEETS findRowBy index:", idx);
  return { index: idx, row: idx >= 0 ? rows[idx] : null };
}
