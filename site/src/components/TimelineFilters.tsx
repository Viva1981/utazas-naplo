"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export type TimelineFilterState = {
  q: string;        // kereső
  from: string;     // yyyy-mm-dd
  to: string;       // yyyy-mm-dd
  vis: "all" | "public" | "private";
  mine: "0" | "1";  // csak az enyéim
};

export default function TimelineFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const initial = useMemo<TimelineFilterState>(() => ({
    q: sp.get("q") ?? "",
    from: sp.get("from") ?? "",
    to: sp.get("to") ?? "",
    vis: (sp.get("vis") as any) ?? "all",
    mine: (sp.get("mine") as any) ?? "0",
  }), [sp]);

  const [state, setState] = useState<TimelineFilterState>(initial);

  // ha url változik (pl. back/forward), szinkronizáljuk a formot
  useEffect(() => { setState(initial); }, [initial]);

  function apply(next: Partial<TimelineFilterState>) {
    const merged = { ...state, ...next };
    const p = new URLSearchParams();
    if (merged.q) p.set("q", merged.q);
    if (merged.from) p.set("from", merged.from);
    if (merged.to) p.set("to", merged.to);
    if (merged.vis && merged.vis !== "all") p.set("vis", merged.vis);
    if (merged.mine === "1") p.set("mine", "1");
    router.replace(`${pathname}?${p.toString()}`);
  }

  return (
    <div className="sticky top-14 z-20 bg-white/90 backdrop-blur border rounded-lg p-3 grid gap-2 sm:grid-cols-5">
      <input
        value={state.q}
        onChange={(e)=>apply({ q: e.target.value })}
        placeholder="Keresés cím / úti cél"
        className="border rounded px-2 py-1 sm:col-span-2"
      />
      <select
        value={state.vis}
        onChange={(e)=>apply({ vis: e.target.value as any })}
        className="border rounded px-2 py-1"
      >
        <option value="all">Összes</option>
        <option value="public">Csak publikus</option>
        <option value="private">Csak privát (saját)</option>
      </select>
      <input
        type="date"
        value={state.from}
        onChange={(e)=>apply({ from: e.target.value })}
        className="border rounded px-2 py-1"
      />
      <input
        type="date"
        value={state.to}
        onChange={(e)=>apply({ to: e.target.value })}
        className="border rounded px-2 py-1"
      />
      <label className="flex items-center gap-2 text-sm sm:col-span-5">
        <input
          type="checkbox"
          checked={state.mine === "1"}
          onChange={(e)=>apply({ mine: e.target.checked ? "1" : "0" })}
        />
        Csak az én útjaim
      </label>
    </div>
  );
}
