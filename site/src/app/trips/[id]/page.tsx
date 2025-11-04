"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";

type Trip = {
  id: string;
  title: string;
  start_date?: string;
  end_date?: string;
  destination?: string;
  owner_user_id?: string;
  visibility?: "public" | "private";
};

function niceDate(d?: string) {
  if (!d) return "";
  const [Y, M, D] = d.split("-");
  return `${Y}.${M}.${D}`;
}

export default function Page() {
  const { id } = useParams<{ id: string }>();
  return <TripDetail key={id} id={String(id)} />;
}

function TripDetail({ id }: { id: string }) {
  const { data: sess } = useSession();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [heroUrl, setHeroUrl] = useState<string>("");

  const isOwner =
    !!(sess?.user?.email && trip?.owner_user_id) &&
    sess.user.email.toLowerCase() === (trip!.owner_user_id as string).toLowerCase();

  useEffect(() => {
    let alive = true;
    (async () => {
      const r = await fetch(`/api/trips/get/${id}`, { cache: "no-store" });
      if (!alive) return;
      if (!r.ok) {
        setNotFound(true);
        return;
      }
      const t: Trip = await r.json();
      setTrip(t);

      // 🎨 hero image unsplash
      const q = encodeURIComponent(t.destination || t.title || "travel");
      setHeroUrl(`https://source.unsplash.com/1600x900/?${q}`);
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  if (notFound)
    return (
      <main className="p-8 text-center text-gray-500">
        <h2>Nincs ilyen út</h2>
      </main>
    );
  if (!trip)
    return (
      <main className="p-8 text-center text-gray-400 animate-pulse">
        <p>Betöltés…</p>
      </main>
    );

  return (
    <main className="min-h-screen bg-gradient-to-b from-white via-blue-50 to-white text-gray-800">
      {/* 🏔️ Hero section */}
      <section className="relative h-[50vh] w-full overflow-hidden rounded-b-3xl shadow-md">
        {heroUrl && (
          <img
            src={heroUrl}
            alt={trip.destination || "Utazás"}
            className="absolute inset-0 h-full w-full object-cover brightness-90 transition-transform duration-700 hover:scale-105"
          />
        )}
        <div className="absolute inset-0 bg-black/30 flex flex-col items-center justify-center text-white text-center px-4">
          <h1 className="text-4xl md:text-6xl font-semibold drop-shadow-lg">
            {trip.title}
          </h1>
          <p className="text-lg md:text-2xl mt-3 opacity-90">
            {trip.destination}
          </p>
          <p className="text-sm mt-2 opacity-75">
            {niceDate(trip.start_date)} → {niceDate(trip.end_date)}
          </p>
        </div>
      </section>

      {/* ℹ️ Trip info + visibility */}
      <section className="max-w-5xl mx-auto p-6 mt-10 bg-white/70 backdrop-blur-lg rounded-xl shadow-lg">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-2xl font-semibold mb-1">{trip.title}</h2>
            <p className="text-gray-600">{trip.destination}</p>
          </div>

          {isOwner && (
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                Láthatóság:
                <select
                  value={trip.visibility || "private"}
                  onChange={async (e) => {
                    const v = e.target.value as "public" | "private";
                    const r = await fetch(`/api/trips/visibility/${trip.id}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ visibility: v }),
                      credentials: "include",
                    });
                    if (r.ok) setTrip({ ...trip, visibility: v });
                  }}
                  className="border rounded-md px-2 py-1 text-gray-700 bg-white shadow-sm"
                >
                  <option value="private">Privát</option>
                  <option value="public">Publikus</option>
                </select>
              </label>
              <span className="text-xs text-gray-500">
                {trip.visibility === "public" ? "🌍 Látható mindenkinek" : "🔒 Csak neked"}
              </span>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

