// site/src/app/api/sheets/append/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth"; // ha nincs alias: "../../../../lib/auth"

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !(session as any).accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accessToken = (session as any).accessToken as string;
  const { values } = await req.json(); // pl. { "values": ["2025-11-01", "Hello Sheets!", "Utazás Napló"] }

  const spreadsheetId = process.env.GOOGLE_SHEETS_DB_SPREADSHEET_ID!;
  const range = "Sheet1!A1";

  const resp = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=RAW`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ values: [values] }),
    }
  );

  const data = await resp.json();
  if (!resp.ok) {
    return NextResponse.json({ error: data }, { status: resp.status });
  }
  return NextResponse.json({ ok: true, updatedRange: data.updates?.updatedRange ?? null });
}
