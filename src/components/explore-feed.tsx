"use client";

import { useEffect, useMemo, useState } from "react";
import type { RadarItem, RadarType } from "@/lib/radar";
import { RadarCard } from "@/components/radar-card";
import { SpotlightRelease } from "@/components/radar-feed";

const categories: { key: RadarType; label: string }[] = [
  { key: "MOVIE", label: "Movies" }, { key: "SHOW", label: "Series" },
  { key: "GAME", label: "Games" }, { key: "MUSIC", label: "Music" },
];

const movieGenres = [[28,"Action"],[12,"Adventure"],[16,"Animation"],[35,"Comedy"],[80,"Crime"],[99,"Documentary"],[18,"Drama"],[10751,"Family"],[14,"Fantasy"],[36,"History"],[27,"Horror"],[10402,"Music"],[9648,"Mystery"],[10749,"Romance"],[878,"Science Fiction"],[53,"Thriller"],[10752,"War"],[37,"Western"]] as const;
const showGenres = [[10759,"Action & Adventure"],[16,"Animation"],[35,"Comedy"],[80,"Crime"],[99,"Documentary"],[18,"Drama"],[10751,"Family"],[10762,"Kids"],[9648,"Mystery"],[10763,"News"],[10764,"Reality"],[10765,"Sci-Fi & Fantasy"],[10766,"Soap"],[10767,"Talk"],[10768,"War & Politics"],[37,"Western"]] as const;

export function ExploreFeed({ upcomingItems, initialMovies }: { upcomingItems: RadarItem[]; initialMovies: RadarItem[] }) {
  const [active, setActive] = useState<RadarType>("MOVIE");
  const [genre, setGenre] = useState("");
  const [year, setYear] = useState("");
  const [sort, setSort] = useState<"popular" | "rated">("popular");
  const [page, setPage] = useState(1);
  const [catalog, setCatalog] = useState<RadarItem[]>(initialMovies);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isBrowseType = active === "MOVIE" || active === "SHOW";
  const items = useMemo(() => isBrowseType ? catalog : upcomingItems.filter((item) => item.type === active)
    .slice().sort((a, b) => sort === "rated"
      ? (b.voteAverage ?? b.popularity) - (a.voteAverage ?? a.popularity)
      : b.popularity - a.popularity), [active, catalog, isBrowseType, sort, upcomingItems]);

  useEffect(() => {
    if (!isBrowseType) return;
    let cancelled = false;
    const params = new URLSearchParams({ type: active, sort, page: String(page) });
    if (genre) params.set("genre", genre);
    if (year) params.set("year", year);
    setLoading(true);
    setError("");
    fetch(`/api/discover?${params.toString()}`)
      .then(async (response) => {
        const result = await response.json() as { items?: RadarItem[]; error?: string };
        if (!response.ok) throw new Error(result.error || "The catalog could not load.");
        return result.items ?? [];
      })
      .then((nextItems) => { if (!cancelled) setCatalog((current) => page === 1 ? nextItems : [...current, ...nextItems]); })
      .catch((cause: unknown) => { if (!cancelled) setError(cause instanceof Error ? cause.message : "The catalog could not load."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [active, genre, isBrowseType, page, sort, year]);

  function changeCategory(type: RadarType) {
    setActive(type);
    if (type !== active && (type === "MOVIE" || type === "SHOW")) setCatalog([]);
    setGenre("");
    setYear("");
    setPage(1);
  }

  function changeFilter(setter: (value: string) => void, value: string) {
    setter(value);
    setPage(1);
  }

  const availableGenres = active === "SHOW" ? showGenres : movieGenres;
  const years = useMemo(() => Array.from({ length: 36 }, (_, index) => String(new Date().getFullYear() - index)), []);
  const featured = useMemo(() => items.slice().sort((a, b) => (b.voteAverage ?? 0) - (a.voteAverage ?? 0) || b.popularity - a.popularity)[0], [items]);
  const otherItems = items.filter((item) => item !== featured);

  return (
    <section>
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="glass flex w-fit flex-wrap gap-1 rounded-full p-1" role="tablist" aria-label="Explore category">
          {categories.map(({ key, label }) => <button key={key} type="button" role="tab" aria-selected={active === key} onClick={() => changeCategory(key)} className={`rounded-full px-4 py-2.5 text-xs font-medium transition sm:px-5 ${active === key ? "bg-white/15 text-white" : "text-slate-400 hover:bg-white/[.06] hover:text-white"}`}>{label}</button>)}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select aria-label="Genre" value={genre} onChange={(event) => changeFilter(setGenre, event.target.value)} disabled={!isBrowseType} className="glass rounded-full px-4 py-2.5 text-xs text-slate-200 outline-none disabled:opacity-45">
            <option value="">Genre</option>{availableGenres.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
          <select aria-label="Year" value={year} onChange={(event) => changeFilter(setYear, event.target.value)} disabled={!isBrowseType} className="glass rounded-full px-4 py-2.5 text-xs text-slate-200 outline-none disabled:opacity-45">
            <option value="">Year</option>{years.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
          <select aria-label="Sort releases" value={sort} onChange={(event) => { setSort(event.target.value as "popular" | "rated"); setPage(1); }} className="glass rounded-full px-4 py-2.5 text-xs text-slate-200 outline-none">
            <option value="popular">• Popular</option><option value="rated">★ Top rated</option>
          </select>
        </div>
      </div>
      <p className="mb-5 text-xs text-slate-500">{active === "MOVIE" ? "Browse American movies across the catalog." : active === "SHOW" ? "Browse American series across the catalog." : active === "GAME" ? "A curated list of upcoming PC games." : "A curated list of upcoming U.S. music releases."}</p>

      {featured && <SpotlightRelease item={featured} label={(featured.voteAverage ?? 0) > 0 ? `Top rated · ★ ${featured.voteAverage?.toFixed(1)}` : "Popular right now"} />}
      {error && <div role="status" className="glass mb-5 rounded-2xl p-4 text-sm text-rose-100">{error}</div>}
      {items.length ? <div className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 sm:gap-x-5 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">{otherItems.map((item) => <RadarCard key={`${item.source}:${item.sourceId}`} item={item} />)}</div> : !loading && <div className="glass rounded-3xl p-8 text-sm text-slate-400">No matching releases in this catalog.</div>}
      {loading && <p role="status" className="mt-6 text-center text-xs text-slate-500">Finding titles…</p>}
      {isBrowseType && items.length > 0 && <div className="mt-8 text-center"><button type="button" disabled={loading} onClick={() => setPage((current) => current + 1)} className="glass rounded-full px-5 py-3 text-sm text-slate-200 transition hover:bg-white/10 disabled:opacity-50">Show more</button></div>}
      {!isBrowseType && items.length > 0 && <p className="mt-6 text-center text-xs text-slate-500">{items.length} upcoming listings</p>}
    </section>
  );
}
