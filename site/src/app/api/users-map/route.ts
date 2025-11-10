export const runtime = "nodejs"; // fontos!

import { NextResponse } from "next/server";

/**
 * Dinamikus import (Turbopack-barát)
 * és biztonságos fallback hiba esetén.
 */
export async function GET() {
  try {
    const { google } = await import("googleapis");

    const spreadsheetId = process.env.SHEETS_SPREADSHEET_ID;
    const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKeyRaw = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || "";
    const privateKey = privateKeyRaw.replace(/\\n/g, "\n");

    if (!spreadsheetId || !clientEmail || !privateKey) {
      console.error("Missing Google Sheets credentials");
      return NextResponse.json(
        { error: "Missing Google Sheets credentials (env vars)" },
        { status: 500 }
      );
    }

    // Google Sheets auth
    const auth = new google.auth.JWT({
      email: clientEmail,
      key: privateKey,
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });

    const sheets = google.sheets({ version: "v4", auth });

    // Lekérés: Users sheet (ha máshogy hívják, írd meg és javítom)
    const range = "Users!A:Z";
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
      valueRenderOption: "UNFORMATTED_VALUE",
    });

    const rows = res.data.values || [];
    if (rows.length < 2) return NextResponse.json({}, { status: 200 });

    // fejléc indexelés
    const headers = rows[0].map((h: any) => String(h || "").trim().toLowerCase());
    const idxUserId = headers.indexOf("user_id");
    const idxName = headers.indexOf("display_name");

    const dataRows = rows.slice(1);
    const users: Record<string, string> = {};

    for (const row of dataRows) {
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
    console.error("users-map error:", err);
    return NextResponse.json(
      { error: "Failed to fetch user map" },
      { status: 500 }
    );
  }
}
