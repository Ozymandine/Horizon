"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { RadarItem, RadarShelf, RadarType } from "@/lib/radar";
import { discoverShelves } from "@/lib/discover-shelves";
import { inferSearchType } from "@/lib/search-category";
import { RadarCard } from "@/components/radar-card";

const categories: { key: RadarType; label: string }[] = [
  { key: "MOVIE", label: "Movies" }, { key: "SHOW", label: "Series" },
  { key: "GAME", label: "Games" }, { key: "MUSIC", label: "Music" },
];

function queryString(type: RadarType, genre: string, year: string, sort: string, all: boolean, query = "") {
  const params = new URLSearchParams({ type, sort });
  if (genre) params.set("genre", genre);
  if (year) params.set("year", year);
  if (all) params.set("all", "1");
  if (query.trim()) params.set("q", query.trim());
  return params.toString();
}

export function ExploreFeed({ initialType = "MOVIE", initialGenre = "", initialYear = "", initialSort = "popular", initialAll = false, initialQuery = "", initialItems, initialShelves }: {
  initialType?: RadarType;
  initialGenre?: string;
  initialYear?: string;
  initialSort?: "popular" | "rated";
  initialAll?: boolean;
  initialQuery?: string;
  initialItems: RadarItem[];
  initialShelves: RadarShelf[];
}) {
  const [active, setActive] = useState<RadarType>(initialType);
  const [genre, setGenre] = useState(initialGenre);
  const [year, setYear] = useState(initialYear);
  const [sort, setSort] = useState<"popular" | "rated">(initialSort);
  const [allMode, setAllMode] = useState(initialAll);
  const [catalog, setCatalog] = useState<RadarItem[]>(initialItems);
  const [shelves, setShelves] = useState<RadarShelf[]>(initialShelves);
  const [query, setQuery] = useState(initialQuery);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const firstRequest = useRef(true);

  const currentQuery = queryString(active, genre, year, sort, allMode, query);
  const returnTo = `/discover?${currentQuery}`;

  useEffect(() => {
    window.history.replaceState(null, "", `/discover?${currentQuery}`);
  }, [currentQuery]);

  useEffect(() => {
    if (firstRequest.current) {
      firstRequest.current = false;
      return;
    }
    let cancelled = false;
    const controller = new AbortController();
    setLoading(true);
    setError("");

    const endpoint = allMode
      ? `/api/discover?${queryString(active, genre, year, sort, true)}`
      : `/api/discover/shelves?${new URLSearchParams({ type: active, ...(year ? { year } : {}), sort })}`;

    fetch(endpoint, { signal: controller.signal })
      .then(async (response) => {
        const result = await response.json() as { items?: RadarItem[]; shelves?: RadarShelf[]; error?: string };
        if (!response.ok) throw new Error(result.error || "The catalog could not load.");
        return result;
      })
      .then((result) => {
        if (cancelled) return;
        if (allMode) setCatalog(result.items ?? []);
        else setShelves(result.shelves ?? []);
      })
      .catch((cause: unknown) => {
        if (!cancelled && !(cause instanceof DOMException && cause.name === "AbortError")) {
          setError(cause instanceof Error ? cause.message : "The catalog could not load.");
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; controller.abort(); };
  }, [active, allMode, genre, sort, year]);

  const knownItems = useMemo(() => [...catalog, ...shelves.flatMap((shelf) => shelf.items)], [catalog, shelves]);
  useEffect(() => {
    const inferred = inferSearchType(query, knownItems);
    if (inferred && inferred !== active) {
      setActive(inferred);
      setGenre("");
      setAllMode(false);
    }
  }, [active, knownItems, query]);

  const years = useMemo(() => Array.from({ length: new Date().getFullYear() + 6 - 1989 }, (_, index) => String(new Date().getFullYear() + 5 - index)), []);
  const filteredShelves = shelves.map((shelf) => ({
    ...shelf,
    items: query ? shelf.items.filter((item) => item.title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())) : shelf.items,
  })).filter((shelf) => shelf.items.length > 0);
  const filteredCatalog = query ? catalog.filter((item) => item.title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())) : catalog;
  const categoryName = categories.find((category) => category.key === active)?.label ?? "Discover";

  function changeCategory(type: RadarType) {
    setActive(type);
    setGenre("");
    setAllMode(false);
    setQuery("");
  }

  return <section>
    <div className="mb-7 flex flex-col gap-4 2xl:flex-row 2xl:items-center 2xl:justify-between">
      <div className="glass flex w-fit flex-wrap gap-1 rounded-full p-1" role="tablist" aria-label="Explore category">
        {categories.map(({ key, label }) => <button key={key} type="button" role="tab" aria-selected={active === key} onClick={() => changeCategory(key)} className={`rounded-full px-5 py-3 text-sm font-medium transition sm:px-6 ${active === key ? "bg-white/15 text-white shadow-inner shadow-white/5" : "text-slate-400 hover:bg-white/[.06] hover:text-white"}`}>{label}</button>)}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <select aria-label="Genre" value={genre} onChange={(event) => { setGenre(event.target.value); setAllMode(Boolean(event.target.value)); }} className="glass rounded-full px-4 py-3 text-sm text-slate-200 outline-none">
          <option value="">Genre</option>{discoverShelves[active].map((shelf) => <option key={shelf.value} value={shelf.value}>{shelf.label}</option>)}
        </select>
        <select aria-label="Year" value={year} onChange={(event) => setYear(event.target.value)} className="glass rounded-full px-4 py-3 text-sm text-slate-200 outline-none">
          <option value="">Any year</option>{years.map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
        <select aria-label="Sort releases" value={sort} onChange={(event) => setSort(event.target.value as "popular" | "rated")} className="glass rounded-full px-4 py-3 text-sm text-slate-200 outline-none">
          <option value="popular">• Popular</option><option value="rated">{active === "MUSIC" ? "↻ Most replayed" : "★ Top rated"}</option>
        </select>
        <label className="glass flex min-w-56 items-center gap-2 rounded-full px-4 py-3 text-slate-300 sm:min-w-64">
          <span aria-hidden className="text-base">⌕</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search Discover" className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-300" />
        </label>
      </div>
    </div>

    <p className="mb-6 text-sm text-slate-300">Browse {categoryName.toLocaleLowerCase()} by genre. These catalogs use published listings and audience data.</p>
    {error && <div role="status" className="glass mb-5 rounded-2xl p-4 text-sm text-rose-100">{error}</div>}

    {allMode ? <>
      <div className="mb-5 flex items-center justify-between gap-4">
        <h2 className="text-lg font-medium text-white">{genre ? discoverShelves[active].find((shelf) => shelf.value === genre)?.label : categoryName}</h2>
        <button type="button" onClick={() => { setAllMode(false); setGenre(""); }} className="text-sm text-slate-300 transition hover:text-white">Back to browse</button>
      </div>
      {filteredCatalog.length ? <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 sm:gap-x-5 lg:grid-cols-4 xl:grid-cols-5">{filteredCatalog.map((item) => <RadarCard key={`${item.source}:${item.sourceId}`} item={item} returnTo={returnTo} />)}</div> : !loading && <div className="glass rounded-3xl p-8 text-sm text-slate-300">No matching titles in this catalog.</div>}
    </> : filteredShelves.length ? <div className="space-y-10">
      {filteredShelves.map((shelf) => <section key={shelf.value}>
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-lg font-medium text-white sm:text-xl">{shelf.label}</h2>
          <Link href={`/discover?${queryString(active, shelf.value, year, sort, true, query)}`} className="shrink-0 text-sm text-slate-300 transition hover:text-white">Show all <span aria-hidden="true">→</span></Link>
        </div>
        <div className="-mx-1 flex snap-x gap-4 overflow-x-auto px-1 pb-3">
          {shelf.items.map((item) => <div key={`${item.source}:${item.sourceId}`} className="w-[calc((100%_-_1rem)/2)] shrink-0 snap-start sm:w-[calc((100%_-_2rem)/3)] md:w-[calc((100%_-_3rem)/4)] xl:w-[calc((100%_-_4rem)/5)]"><RadarCard item={item} returnTo={returnTo} /></div>)}
        </div>
      </section>)}
    </div> : !loading && <div className="glass rounded-3xl p-8 text-sm text-slate-300">No matching titles in this catalog.</div>}

    {loading && <p role="status" className="mt-6 text-center text-sm text-slate-300">Finding titles…</p>}
  </section>;
}
