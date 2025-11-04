// ⬅️ SERVER COMPONENT (nincs "use client")
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Link from "next/link";
import { redirect } from "next/navigation";

// Ne próbálja statikusan generálni buildkor
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

export default async function ProtectedPage() {
  // Szerveren kérjük le a sessiont
  const session = await getServerSession(authOptions);

  // Ha nincs bejelentkezve, irány a signin (NextAuth default)
  if (!session) {
    redirect("/api/auth/signin");
  }

  // Innentől biztosan van session
  const user = (session.user as any) || {};

  return (
    <main style={{ padding: 24, display: "grid", gap: 16 }}>
      <h1 style={{ margin: 0 }}>Védett oldal</h1>
      <p style={{ color: "#555" }}>
        Bejelentkezve mint <b>{user.email || user.name || "felhasználó"}</b>.
      </p>

      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <Link href="/timeline" style={{ padding: "8px 12px", border: "1px solid #ddd", borderRadius: 6, textDecoration: "none" }}>
          Ugrás az Idővonalra
        </Link>
        <Link href="/" style={{ padding: "8px 12px", border: "1px solid #ddd", borderRadius: 6, textDecoration: "none" }}>
          Kezdőlap
        </Link>
      </div>
    </main>
  );
}


