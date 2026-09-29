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

export function SpotlightRelease({ item, label = "Featured", returnTo = "/" }: { item: RadarItem; label?: string; returnTo?: string }) {
  const href = item.href.startsWith("/") ? `${item.href}?returnTo=${encodeURIComponent(returnTo)}` : item.href;
  const artwork = <>
    {item.backdropUrl
      ? <img src={item.backdropUrl} alt="" className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-[1.025]" />
      : <div className="absolute inset-0"><MediaArtwork title={item.title} type={item.type} imageUrl={item.posterUrl} fallbackUrls={item.posterFallbackUrls} /></div>}
    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/15 to-black/5 opacity-35 transition group-hover:opacity-85" />
    <span aria-hidden="true" className="absolute left-1/2 top-1/2 grid size-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white text-black opacity-0 shadow-xl transition group-hover:opacity-100">▶</span>
    <div className="absolute inset-x-0 bottom-0 translate-y-2 p-5 opacity-0 transition group-hover:translate-y-0 group-hover:opacity-100 sm:p-7">
      <h2 className="text-xl font-semibold text-white sm:text-2xl">{item.title}</h2>
      <div className="mt-1.5 flex items-center gap-3 text-sm text-white/80"><span>{item.displayDate}</span>{item.voteAverage && item.voteAverage > 0 ? <span className="text-amber-200">★ {item.voteAverage.toFixed(1)}</span> : null}</div>
    </div>
  </>;
  return <section className="mb-8">
    <p className="mb-3 text-xs font-semibold uppercase tracking-[.18em] text-slate-400">{label}</p>
    {item.href.startsWith("/")
      ? <Link href={href} aria-label={`Featured: ${item.title}`} className="group relative block aspect-[2.5/1] min-h-48 overflow-hidden rounded-[1.5rem] border border-white/10 bg-slate-950 shadow-2xl shadow-black/25 sm:aspect-[3.2/1]">{artwork}</Link>
      : <a href={href} target="_blank" rel="noreferrer" aria-label={`Featured: ${item.title}`} className="group relative block aspect-[2.5/1] min-h-48 overflow-hidden rounded-[1.5rem] border border-white/10 bg-slate-950 shadow-2xl shadow-black/25 sm:aspect-[3.2/1]">{artwork}</a>}
  </section>;
}

export function RadarFeed({ items, emptyMessage }: { items: RadarItem[]; emptyMessage: string }) {
  const [active, setActive] = useState<(typeof filters)[number]["key"]>("MOVIE");
  const [query, setQuery] = useState("");
  const visible = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return items.filter((item) => item.type === active
      && (!normalized || item.title.toLocaleLowerCase().includes(normalized)))
      .slice().sort((a, b) => releaseTime(a) - releaseTime(b) || a.title.localeCompare(b.title));
  }, [active, items, query]);
  const featured = useMemo(() => visible.slice().sort((a, b) => ratingScore(b) - ratingScore(a) || b.popularity - a.popularity)[0], [visible]);
  const gridItems = visible.filter((item) => item !== featured);

  return <div>
    <div className="mb-7 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="glass flex w-fit flex-wrap gap-1 rounded-full p-1" role="tablist" aria-label="Filter releases by category">
        {filters.map((filter) => <button key={filter.key} type="button" role="tab" aria-selected={active === filter.key} onClick={() => setActive(filter.key)} className={`rounded-full px-5 py-3 text-sm font-medium transition ${active === filter.key ? "bg-white/15 text-white shadow-inner shadow-white/5" : "text-slate-400 hover:bg-white/[.06] hover:text-white"}`}>{filter.label}</button>)}
      </div>
      <label className="glass flex items-center gap-2 rounded-full px-4 py-3 text-slate-400 lg:w-72">
        <span aria-hidden className="text-base">⌕</span>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a release" className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-500" />
      </label>
    </div>
    {visible.length ? <>
      {featured && <SpotlightRelease item={featured} label={ratingScore(featured) ? "Top rated" : "Featured"} />}
      <div className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 sm:gap-x-6 lg:grid-cols-4 lg:gap-x-7">
        {gridItems.map((item) => <RadarCard key={`${item.source}:${item.sourceId}`} item={item} returnTo="/" />)}
      </div>
    </> : <div className="glass rounded-3xl p-8 text-sm leading-6 text-slate-400">{query ? `No upcoming releases match “${query}”.` : emptyMessage}</div>}
  </div>;
}
