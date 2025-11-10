import { Suspense } from "react";
import TripsClient from "./TripsClient";

export default function TripsPage() {
  return (
    <Suspense fallback={<p>Betöltés…</p>}>
      <TripsClient />
    </Suspense>
  );
}
