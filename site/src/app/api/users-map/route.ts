export const runtime = "nodejs"; // fontos!

import { NextResponse } from "next/server";

export async function GET() {
  try {
    // @ts-ignore – Turbopack kompatibilis dinamikus import
    const { google } = await import("googleapis");

    // ✅ támogatja mindkét környezeti változó nevet
    const spreadsheetId =
      process.env.GOOGLE_SHEETS_DB_SPREADSHEET_ID ||
      process.env.SHEETS_SPREADSHEET_ID;

    const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKeyRaw = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || "";
    const privateKey = privateKeyRaw.replace(/\\n/g, "\n");

    if (!spreadsheetId || !clientEmail || !privateKey) {
      console.error("Missing Google Sheets credentials", {
        hasSpreadsheetId: !!spreadsheetId,
        hasEmail: !!clientEmail,
        hasKey: !!privateKeyRaw,
      });
      return NextResponse.json(
        { error: "Missing Google Sheets credentials (env vars)" },
        { status: 500 }
      );
    }

    const auth = new google.auth.JWT({
      email: clientEmail,
      key: privateKey,
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });

    const sheets = google.sheets({ version: "v4", auth });

    const range = "Users!A:Z";
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
      valueRenderOption: "UNFORMATTED_VALUE",
    });

    const rows = res.data.values || [];
    if (rows.length < 2) {
      return new NextResponse("{}", {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=60",
        },
      });
    }

    const headers = rows[0].map((h: any) => String(h || "").trim().toLowerCase());
    const idxUserId = headers.indexOf("user_id");
    const idxName = headers.indexOf("display_name");

    const users: Record<string, string> = {};
    for (const row of rows.slice(1)) {
      const userId = String(row[idxUserId] ?? "").trim();
      const name = String(row[idxName] ?? "").trim();
      if (userId) users[userId] = name || "—";
    }

    return new NextResponse(JSON.stringify(users), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=60",
      },
    });
  } catch (err) {
    console.error("GET /api/users-map error:", err);
    return NextResponse.json({ error: "Failed to load users map" }, { status: 500 });
  }
}
