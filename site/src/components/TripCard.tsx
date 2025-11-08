"use client";

import Link from "next/link";

export type TripCardProps = {
  id: string;
  title: string;
  destination?: string;
  start_date?: string; // yyyy-mm-dd
  end_date?: string;   // yyyy-mm-dd
  visibility?: "public" | "private";
};

function fmt(d?: string) {
  if (!d) return "";
  const [Y, M, D] = d.split("-");
  return `${Y}.${M}.${D}`;
}

export default function TripCard(props: TripCardProps) {
  const { id, title, destination, start_date, end_date, visibility } = props;
  return (
    <article className="border rounded-xl p-3 bg-white hover:shadow transition">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link href={`/trips/${id}`} className="font-medium underline">{title}</Link>
          <div className="text-sm text-gray-600">
            {destination || "—"} • {fmt(start_date)} → {fmt(end_date)}
          </div>
        </div>
        {visibility === "private" && (
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-black/70 text-white">
            Privát
          </span>
        )}
      </div>
    </article>
  );
}
