"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { RadarItem, RadarType } from "@/lib/radar";
import { RadarCard } from "@/components/radar-card";

const filters: { key: "ALL" | RadarType; label: string }[] = [
  { key: "ALL", label: "Everything" },
  { key: "MOVIE", label: "Movies" },
  { key: "SHOW", label: "TV & streaming" },
  { key: "GAME", label: "Games" },
  { key: "MUSIC", label: "Music" },
];

export function RadarFeed({ items, emptyMessage }: { items: RadarItem[]; emptyMessage: string }) {
  const [active, setActive] = useState<(typeof filters)[number]["key"]>("ALL");
  const [query, setQuery] = useState("");
  const counts = useMemo(() => Object.fromEntries(filters.map((filter) => [
    filter.key,
    filter.key === "ALL" ? items.length : items.filter((item) => item.type === filter.key).length,
  ])), [items]);
  const visible = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return items.filter((item) => (active === "ALL" || item.type === active)
      && (!normalized || item.title.toLocaleLowerCase().includes(normalized)));
  }, [active, items, query]);

  return (
    <div>
      <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter releases by category">
          {filters.map((filter) => (
            <button key={filter.key} type="button" role="tab" aria-selected={active === filter.key} onClick={() => setActive(filter.key)}
              className={`rounded-full border px-3.5 py-2 text-xs font-medium transition ${active === filter.key ? "border-cyan-200/20 bg-cyan-200/10 text-cyan-100" : "border-white/10 bg-white/[.03] text-slate-400 hover:text-white"}`}>
              {filter.label} <span className="ml-1 text-[10px] opacity-60">{counts[filter.key]}</span>
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[.03] px-3.5 py-2.5 text-slate-400 xl:w-64">
          <Search size={14} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a release" className="min-w-0 flex-1 bg-transparent text-xs text-white outline-none placeholder:text-slate-500" />
        </label>
      </div>

      {visible.length ? (
        <>
          <p className="mb-4 text-xs text-slate-500">Showing {visible.length} upcoming items</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 sm:gap-x-5 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {visible.map((item) => <RadarCard key={`${item.source}:${item.sourceId}`} item={item} />)}
          </div>
        </>
      ) : (
        <div className="glass rounded-3xl p-8 text-sm leading-6 text-slate-400">{query ? `No upcoming releases match “${query}”.` : emptyMessage}</div>
      )}
    </div>
  );
}
