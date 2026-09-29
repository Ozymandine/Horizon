"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { RadarItem, RadarType } from "@/lib/radar";
import { RadarCard } from "@/components/radar-card";
import { MediaArtwork } from "@/components/media-artwork";

const filters: { key: RadarType; label: string }[] = [
  { key: "MOVIE", label: "Movies" },
  { key: "SHOW", label: "Series" },
  { key: "GAME", label: "Games" },
  { key: "MUSIC", label: "Music" },
];

function releaseTime(item: RadarItem) {
  return item.sortTimestamp ? Date.parse(item.sortTimestamp) : Number.POSITIVE_INFINITY;
}

function ratingScore(item: RadarItem) {
  const rating = item.voteAverage ?? 0;
  const count = item.voteCount ?? 0;
  return rating > 0 && count >= 10 ? rating * Math.min(count / 100, 1) : 0;
}

export function SpotlightRelease({ item, label = "Worth the wait" }: { item: RadarItem; label?: string }) {
  return (
    <Link href={item.href} className="group relative mb-8 grid min-h-[280px] overflow-hidden rounded-[1.7rem] border border-white/10 bg-slate-950 sm:min-h-[340px] lg:grid-cols-[1fr_260px]">
      {item.backdropUrl && <img src={item.backdropUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-45 transition duration-700 group-hover:scale-[1.025]" />}
      <div className="absolute inset-0 bg-gradient-to-r from-[#080c12] via-[#080c12]/85 to-[#080c12]/25" />
      <div className="relative flex flex-col items-start justify-end p-6 sm:p-9">
        <span className="rounded-full border border-white/15 bg-black/25 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[.16em] text-white/75">{label}</span>
        <p className="mt-5 text-xs font-semibold uppercase tracking-[.18em] text-cyan-100/80">{item.displayDate}</p>
        <h2 className="mt-2 max-w-2xl text-3xl font-semibold tracking-tight text-white sm:text-5xl">{item.title}</h2>
        <p className="mt-3 line-clamp-2 max-w-2xl text-sm leading-6 text-slate-200/80">{item.description || "A release to keep on your radar."}</p>
        <span className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-white/90">Explore details <span aria-hidden="true">↗</span></span>
      </div>
      <div className="relative hidden min-h-full p-7 lg:block">
        <div className="absolute inset-y-7 right-7 w-[210px] overflow-hidden rounded-2xl border border-white/10 shadow-2xl shadow-black/40">
          <MediaArtwork title={item.title} type={item.type} imageUrl={item.posterUrl} fallbackUrls={item.posterFallbackUrls} />
        </div>
      </div>
    </Link>
  );
}

export function RadarFeed({ items, emptyMessage }: { items: RadarItem[]; emptyMessage: string }) {
  const [active, setActive] = useState<(typeof filters)[number]["key"]>("MOVIE");
  const [query, setQuery] = useState("");
  const counts = useMemo(() => Object.fromEntries(filters.map((filter) => [
    filter.key,
    items.filter((item) => item.type === filter.key).length,
  ])), [items]);
  const visible = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return items.filter((item) => item.type === active
      && (!normalized || item.title.toLocaleLowerCase().includes(normalized)))
      .slice().sort((a, b) => releaseTime(a) - releaseTime(b) || a.title.localeCompare(b.title));
  }, [active, items, query]);
  const featured = useMemo(() => visible.slice().sort((a, b) => ratingScore(b) - ratingScore(a) || b.popularity - a.popularity)[0], [visible]);
  const gridItems = visible.filter((item) => item !== featured);

  return (
    <div>
      <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-end">
        <div className="glass flex w-fit flex-wrap gap-1 rounded-full p-1" role="tablist" aria-label="Filter releases by category">
          {filters.map((filter) => (
            <button key={filter.key} type="button" role="tab" aria-selected={active === filter.key} onClick={() => setActive(filter.key)}
              className={`rounded-full px-4 py-2.5 text-xs font-medium transition sm:px-5 ${active === filter.key ? "bg-white/15 text-white shadow-inner shadow-white/5" : "text-slate-400 hover:bg-white/[.06] hover:text-white"}`}>
              {filter.label}<span className="ml-1.5 text-[10px] opacity-55">{counts[filter.key]}</span>
            </button>
          ))}
        </div>
        <label className="glass flex items-center gap-2 rounded-full px-4 py-3 text-slate-400 xl:w-64">
          <span aria-hidden className="text-base">⌕</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a release" className="min-w-0 flex-1 bg-transparent text-xs text-white outline-none placeholder:text-slate-500" />
        </label>
      </div>

      {visible.length ? (
        <>
          <div className="mb-4 flex items-center justify-between text-xs text-slate-500">
            <p>{visible.length} upcoming {filters.find((filter) => filter.key === active)?.label.toLocaleLowerCase()}</p>
            <p>Sorted by release date</p>
          </div>
          {featured && <SpotlightRelease item={featured} label={ratingScore(featured) ? `Top rated · ★ ${(featured.voteAverage ?? 0).toFixed(1)}` : "In the spotlight"} />}
          <div className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 sm:gap-x-5 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {gridItems.map((item) => <RadarCard key={`${item.source}:${item.sourceId}`} item={item} />)}
          </div>
        </>
      ) : (
        <div className="glass rounded-3xl p-8 text-sm leading-6 text-slate-400">{query ? `No upcoming releases match “${query}”.` : emptyMessage}</div>
      )}
    </div>
  );
}
