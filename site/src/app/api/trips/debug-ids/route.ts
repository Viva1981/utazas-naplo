import { NextResponse } from "next/server";
import { sheetsGet } from "@/lib/sheets";
const norm = (v: unknown) => (v??"").toString().replace(/\u00A0/g," ").trim().toLowerCase();

export async function GET() {
  const { values } = await sheetsGet("Trips!A1:A");
  return NextResponse.json({ raw: values ?? [], normed: (values??[]).map(r => norm(r[0])) });
}
