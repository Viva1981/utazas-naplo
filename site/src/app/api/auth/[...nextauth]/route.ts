// App Router + Turbopack fixek (különben "tölt és semmi")
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

// Egyetlen igaz forrás: a központi auth.ts
export { GET, POST } from "@/auth";

