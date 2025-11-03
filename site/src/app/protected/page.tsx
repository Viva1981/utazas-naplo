import { auth } from "@/auth";
import Link from "next/link";

export default async function ProtectedPage() {
  const session = await auth();
  if (!session) {
    return (
      <main style={{ padding: 24 }}>
        <h2>Bejelentkezés szükséges</h2>
        <p>Menj vissza a főoldalra és kattints a <b>Belépés Google-lel</b> gombra.</p>
        <Link href="/">Vissza a főoldalra</Link>
      </main>
    );
  }
  return (
    <main style={{ padding: 24 }}>
      <h2>Védett oldal ✅</h2>
      <p>Belépve: {session.user?.email}</p>
      <Link href="/">Vissza</Link>
    </main>
  );
}


