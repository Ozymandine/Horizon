"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { RadarItem, RadarType } from "@/lib/radar";
import { RadarCard } from "@/components/radar-card";
import { SpotlightRelease } from "@/components/radar-feed";

const categories: { key: RadarType; label: string }[] = [
  { key: "MOVIE", label: "Movies" }, { key: "SHOW", label: "Series" },
  { key: "GAME", label: "Games" }, { key: "MUSIC", label: "Music" },
];

const movieGenres = [[28,"Action"],[12,"Adventure"],[16,"Animation"],[35,"Comedy"],[80,"Crime"],[99,"Documentary"],[18,"Drama"],[10751,"Family"],[14,"Fantasy"],[36,"History"],[27,"Horror"],[10402,"Music"],[9648,"Mystery"],[10749,"Romance"],[878,"Science Fiction"],[53,"Thriller"],[10752,"War"],[37,"Western"]] as const;
const showGenres = [[10759,"Action & Adventure"],[16,"Animation"],[35,"Comedy"],[80,"Crime"],[99,"Documentary"],[18,"Drama"],[10751,"Family"],[10762,"Kids"],[9648,"Mystery"],[10763,"News"],[10764,"Reality"],[10765,"Sci-Fi & Fantasy"],[10766,"Soap"],[10767,"Talk"],[10768,"War & Politics"],[37,"Western"]] as const;

function queryString(type: RadarType, genre: string, year: string, sort: string, page: number) {
  const params = new URLSearchParams({ type, sort, page: String(page) });
  if (genre) params.set("genre", genre);
  if (year) params.set("year", year);
  return params.toString();
}

export function ExploreFeed({ initialType = "MOVIE", initialGenre = "", initialYear = "", initialSort = "popular", initialPage = 1, initialItems }: {
  initialType?: RadarType;
  initialGenre?: string;
  initialYear?: string;
  initialSort?: "popular" | "rated";
  initialPage?: number;
  initialItems: RadarItem[];
}) {
  const [active, setActive] = useState<RadarType>(initialType);
  const [genre, setGenre] = useState(initialGenre);
  const [year, setYear] = useState(initialYear);
  const [sort, setSort] = useState<"popular" | "rated">(initialSort);
  const [page, setPage] = useState(initialPage);
  const [catalog, setCatalog] = useState<RadarItem[]>(initialItems);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const firstKey = useRef(queryString(initialType, initialGenre, initialYear, initialSort, initialPage));

  const currentQuery = queryString(active, genre, year, sort, page);
  const returnTo = `/discover?${currentQuery}`;
  const isBrowseType = active === "MOVIE" || active === "SHOW";
  const canPage = isBrowseType || (active === "MUSIC" && Boolean(year));

  useEffect(() => {
    window.history.replaceState(null, "", `/discover?${currentQuery}`);
  }, [currentQuery]);

  useEffect(() => {
    if (firstKey.current === currentQuery) {
      firstKey.current = "";
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError("");
    fetch(`/api/discover?${currentQuery}`)
      .then(async (response) => {
        const result = await response.json() as { items?: RadarItem[]; error?: string };
        if (!response.ok) throw new Error(result.error || "The catalog could not load.");
        return result.items ?? [];
      })
      .then((nextItems) => { if (!cancelled) setCatalog((current) => page === 1 ? nextItems : [...current, ...nextItems]); })
      .catch((cause: unknown) => { if (!cancelled) setError(cause instanceof Error ? cause.message : "The catalog could not load."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [currentQuery, page]);

  function changeCategory(type: RadarType) {
    setActive(type);
    setGenre("");
    setYear(type === "GAME" || type === "MUSIC" ? String(new Date().getFullYear()) : "");
    setPage(1);
    setCatalog([]);
  }

  function changeFilter(setter: (value: string) => void, value: string) {
    setter(value);
    setPage(1);
    setCatalog([]);
  }

  const availableGenres = active === "SHOW" ? showGenres : movieGenres;
  const years = useMemo(() => Array.from({ length: new Date().getFullYear() - 1989 }, (_, index) => String(new Date().getFullYear() - index)), []);
  const items = catalog;
  const featured = useMemo(() => items.slice().sort((a, b) => (b.voteAverage ?? 0) - (a.voteAverage ?? 0) || b.popularity - a.popularity)[0], [items]);
  const otherItems = items.filter((item) => item !== featured);
  const description = active === "MOVIE" ? "Explore American movies by genre, year, popularity, or rating."
    : active === "SHOW" ? "Explore American series by genre, year, popularity, or rating."
    : active === "GAME" ? "Explore popular PC games by release year. Soundtracks, demos, and playtests are filtered out."
    : "Explore U.S. album releases by year. Game and film soundtracks are filtered out.";

  return <section>
    <div className="mb-5 flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
      <div className="glass flex w-fit flex-wrap gap-1 rounded-full p-1.5" role="tablist" aria-label="Explore category">
        {categories.map(({ key, label }) => <button key={key} type="button" role="tab" aria-selected={active === key} onClick={() => changeCategory(key)} className={`rounded-full px-5 py-3 text-sm font-medium transition sm:px-6 ${active === key ? "bg-white/15 text-white shadow-inner shadow-white/5" : "text-slate-400 hover:bg-white/[.06] hover:text-white"}`}>{label}</button>)}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <select aria-label="Genre" value={genre} onChange={(event) => changeFilter(setGenre, event.target.value)} disabled={!isBrowseType} className="glass rounded-full px-4 py-3 text-sm text-slate-200 outline-none disabled:opacity-45">
          <option value="">Genre</option>{availableGenres.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select>
        <select aria-label="Year" value={year} onChange={(event) => changeFilter(setYear, event.target.value)} className="glass rounded-full px-4 py-3 text-sm text-slate-200 outline-none">
          <option value="">Year</option>{years.map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
        <select aria-label="Sort releases" value={sort} onChange={(event) => { setSort(event.target.value as "popular" | "rated"); setPage(1); setCatalog([]); }} className="glass rounded-full px-4 py-3 text-sm text-slate-200 outline-none">
          <option value="popular">• Popular</option><option value="rated">★ Top rated</option>
        </select>
      </div>
    </div>
    <p className="mb-6 text-sm text-slate-400">{description}</p>

    {featured && <SpotlightRelease item={featured} label={(featured.voteAverage ?? 0) > 0 ? "Top rated" : "Popular right now"} returnTo={returnTo} />}
    {error && <div role="status" className="glass mb-5 rounded-2xl p-4 text-sm text-rose-100">{error}</div>}
    {items.length ? <div className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 sm:gap-x-6 lg:grid-cols-4 lg:gap-x-7">{otherItems.map((item) => <RadarCard key={`${item.source}:${item.sourceId}`} item={item} returnTo={returnTo} />)}</div> : !loading && <div className="glass rounded-3xl p-8 text-sm text-slate-400">No matching titles in this catalog.</div>}
    {loading && <p role="status" className="mt-6 text-center text-sm text-slate-500">Finding titles…</p>}
    {canPage && items.length > 0 && <div className="mt-8 text-center"><button type="button" disabled={loading} onClick={() => setPage((current) => current + 1)} className="glass rounded-full px-5 py-3 text-sm text-slate-200 transition hover:bg-white/10 disabled:opacity-50">Show more</button></div>}
  </section>;
}
