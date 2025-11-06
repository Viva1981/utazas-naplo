"use client";

import { useSession } from "next-auth/react";

export default function TestAuth() {
  const { data: session, status } = useSession();

  return (
    <main className="max-w-3xl mx-auto px-4 py-10 space-y-6">
      <h1 className="text-2xl font-semibold">Auth diagnosztika</h1>

      <div className="space-x-3">
        <a className="border rounded px-3 py-1" href="/api/auth/signin/google?callbackUrl=%2F">Bejelentkezés (közvetlen)</a>
        <a className="border rounded px-3 py-1" href="/api/auth/signout?callbackUrl=%2F">Kijelentkezés</a>
      </div>

      <pre className="bg-gray-100 p-3 rounded text-xs overflow-auto">
        {JSON.stringify({ status, session }, null, 2)}
      </pre>
    </main>
  );
}
