"use client";

import { SessionProvider } from "next-auth/react";

export default function Providers({ children }: { children: React.ReactNode }) {
  // Nincs trükközés, semmilyen extra állapot – csak a SessionProvider
  return <SessionProvider>{children}</SessionProvider>;
}
