"use client";
import { signIn, signOut, useSession } from "next-auth/react";

export default function AuthButtons() {
  const { status } = useSession();
  if (status === "loading") return null;

  return status === "authenticated" ? (
    <button onClick={() => signOut()} style={{ padding: 8, border: "1px solid #ddd", borderRadius: 6 }}>
      Kilépés
    </button>
  ) : (
    <button onClick={() => signIn("google")} style={{ padding: 8, border: "1px solid #ddd", borderRadius: 6 }}>
      Belépés Google-lel
    </button>
  );
}
