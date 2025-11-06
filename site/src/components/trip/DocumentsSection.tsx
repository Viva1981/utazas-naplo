"use client";
import { useEffect, useState } from "react";
import DocumentCard from "./DocumentCard";

type TripDocument = {
  id: string;
  trip_id: string;
  owner_user_id: string;
  filename: string;
  url: string;
  mime: string;
  visibility: "public" | "private";
  created_at: string;
};

export default function DocumentsSection({ tripId }: { tripId: string }) {
  const [docs, setDocs] = useState<TripDocument[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch(`/api/trips/${tripId}/documents`, { cache: "no-store" });
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        if (mounted) setDocs(data.documents ?? []);
      } catch (err: any) {
        if (mounted) setError(err?.message || "Hiba a dokumentumok lekérésekor.");
      }
    })();
    return () => { mounted = false; };
  }, [tripId]);

  if (error) {
    // Ha hiba van, ownernek jelezhetjük, de public nézetben elrejthetjük.
    return null;
  }

  if (!docs) {
    // Loading állapotban ne villogjunk szekcióval
    return null;
  }

  if (docs.length === 0) {
    // NINCS megjeleníthető dokumentum → TELJES SZEKCIÓ ELREJTÉSE
    return null;
  }

  return (
    <section>
      <h2>Dokumentumok</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
        {docs.map((d) => (
          <DocumentCard key={d.id} doc={d} />
        ))}
      </div>
    </section>
  );
}
