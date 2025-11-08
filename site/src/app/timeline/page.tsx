import { Suspense } from "react";
import TimelineClient from "./TimelineClient";

export default function TimelinePage() {
  return (
    <main className="max-w-5xl mx-auto px-4 py-4 md:py-8 grid gap-4">
      <h1 className="text-xl md:text-2xl font-semibold">Idővonal</h1>
      <Suspense fallback={<p>Betöltés…</p>}>
        <TimelineClient />
      </Suspense>
    </main>
  );
}

