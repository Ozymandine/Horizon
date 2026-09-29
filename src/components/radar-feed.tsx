"use client";

import { useEffect, useMemo, useState } from "react";
import type { RadarItem, RadarType } from "@/lib/radar";
import { inferSearchType } from "@/lib/search-category";
import { RadarCard } from "@/components/radar-card";

const filters: { key: RadarType; label: string }[] = [
  { key: "MOVIE", label: "Movies" },
  { key: "SHOW", label: "Series" },
  { key: "GAME", label: "Games" },
  { key: "MUSIC", label: "Music" },
];

function releaseTime(item: RadarItem) {
  return item.sortTimestamp ? Date.parse(item.sortTimestamp) : Number.POSITIVE_INFINITY;
}

export function RadarFeed({ items, emptyMessage }: { items: RadarItem[]; emptyMessage: string }) {
  const [active, setActive] = useState<RadarType>("MOVIE");
  const [query, setQuery] = useState("");

  useEffect(() => {
    const inferred = inferSearchType(query, items);
    if (inferred) setActive(inferred);
  }, [items, query]);

  const visible = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return items.filter((item) => item.type === active
      && (!normalized || item.title.toLocaleLowerCase().includes(normalized)))
      .slice().sort((a, b) => releaseTime(a) - releaseTime(b) || a.title.localeCompare(b.title));
  }, [active, items, query]);

  return <div>
    <div className="mb-7 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="glass flex w-fit flex-wrap gap-1 rounded-full p-1" role="tablist" aria-label="Filter releases by category">
        {filters.map((filter) => <button key={filter.key} type="button" role="tab" aria-selected={active === filter.key} onClick={() => setActive(filter.key)} className={`rounded-full px-5 py-3 text-sm font-medium transition ${active === filter.key ? "bg-white/15 text-white shadow-inner shadow-white/5" : "text-slate-400 hover:bg-white/[.06] hover:text-white"}`}>{filter.label}</button>)}
      </div>
      <label className="glass flex items-center gap-2 rounded-full px-4 py-3 text-slate-400 lg:w-72">
        <span aria-hidden className="text-base">⌕</span>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a release" className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-400" />
      </label>
    </div>
    {visible.length ? <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 sm:gap-x-5 lg:grid-cols-4 xl:grid-cols-5">
      {visible.map((item) => <RadarCard key={`${item.source}:${item.sourceId}`} item={item} returnTo="/" />)}
    </div> : <div className="glass rounded-3xl p-8 text-sm leading-6 text-slate-300">{query ? `No upcoming releases match “${query}” in ${filters.find((filter) => filter.key === active)?.label.toLowerCase()}.` : emptyMessage}</div>}
  </div>;
}
