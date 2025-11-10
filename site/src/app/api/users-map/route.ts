import { NextResponse } from "next/server";
import { google } from "googleapis";

// Ha Edge runtime lenne beállítva, kapcsold ki, mert a googleapis Node runtimet igényel.
// export const runtime = "nodejs";

export async function GET() {
  try {
    const spreadsheetId = process.env.SHEETS_SPREADSHEET_ID;
    const clientEmail   = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    // A private key-ben a \n-eket vissza kell alakítani valódi soremeléssé:
    const privateKeyRaw = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || "";
    const privateKey    = privateKeyRaw.replace(/\\n/g, "\n");

    if (!spreadsheetId || !clientEmail || !privateKey) {
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

    // Feltételezzük, hogy a sheet neve "Users" és van fejléc sora.
    // Ha más a neve, írd meg és átírom.
    const range = "Users!A:Z";
    const resp = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
      valueRenderOption: "UNFORMATTED_VALUE",
    });

    const rows = resp.data.values || [];
    if (rows.length === 0) {
      return NextResponse.json({}, { status: 200 });
    }

    // Fejléc → indexelés
    const headers = rows[0].map((h: any) => String(h || "").trim().toLowerCase());
    const data = rows.slice(1);

    const idxUserId = headers.indexOf("user_id");
    const idxName   = headers.indexOf("display_name");

    const map: Record<string, string> = {};
    for (const r of data) {
      const userId = String(r[idxUserId] ?? "").trim();
      const name   = String(r[idxName] ?? "").trim();
      if (userId) map[userId] = name || "—";
    }

    // 60 mp cache-elésre CDN/edge szintű header
    return new NextResponse(JSON.stringify(map), {
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
