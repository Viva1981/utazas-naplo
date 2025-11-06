import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

// Ezek fontosak, hogy ne cache-elje és Node runtimen fusson
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

// A legegyszerűbb, "unalmas" exportolás – ez a stabil minta
const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
