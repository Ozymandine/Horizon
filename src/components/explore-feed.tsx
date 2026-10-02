"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, ChevronDown, Clock3, Search, Shuffle, Sparkles, X } from "lucide-react";
import type { RadarItem, RadarType } from "@/lib/radar";
import { discoverShelves } from "@/lib/discover-shelves";
import { countries, defaultDiscovery, discoveryQuery, discoveryRows, discoveryState, mediaCategories, type DiscoveryState } from "@/lib/discovery-options";
import { useDiscoveryCollection, fetchCollection } from "@/lib/use-discovery-collection";
import { MediaArtwork } from "@/components/media-artwork";
import { CinematicHero, CatalogAtmosphere, detailLink } from "@/components/cinematic-hero";
import { MusicTrackList } from "@/components/music-track-list";
import { SpotifySearchResults } from "@/components/spotify-music";
import { useSpotifyConnected } from "@/lib/use-browser-preferences";
import { ScrollRail } from "@/components/scroll-rail";

type Provider = { id: string; name: string; logo: string | null };
type RecentSearch = { q: string; type: RadarType };
const recentKey = "horizon-recent-searches-v1";
function collectionKey(state: DiscoveryState) {
  const params = new URLSearchParams(discoveryQuery(state));
  params.delete("all");
  return params.toString();
}
function readRecent(): RecentSearch[] {
  try { const entries: unknown = JSON.parse(localStorage.getItem(recentKey) ?? "[]"); return Array.isArray(entries) ? entries.filter((entry): entry is RecentSearch => entry && typeof entry.q === "string" && mediaCategories.some((type) => type.value === entry.type)).slice(0, 8) : []; } catch { return []; }
}
function SkeletonCards({ landscape = false }: { landscape?: boolean }) {
  return <div className="discovery-skeleton-row" aria-hidden="true">{Array.from({ length: 8 }, (_, index) => <div key={index} className={`discovery-skeleton ${landscape ? "skeleton-landscape" : ""}`}/>)}</div>;
}
function DiscoveryCard({ item, returnTo, landscape = false }: { item: RadarItem; returnTo: string; landscape?: boolean }) {
  const artist = item.source === "apple-artist";
  return <article className={`discovery-card ${landscape ? "card-landscape" : ""} ${item.type === "MUSIC" ? "card-music" : item.type === "GAME" ? "card-game" : ""} ${artist ? "card-artist" : ""}`}>
    <Link href={detailLink(item, returnTo)} prefetch={false} aria-label={`Open ${item.title}`}>
      <div className="discovery-card-art"><MediaArtwork key={`${item.source}:${item.sourceId}`} title={item.title} type={item.type} imageUrl={landscape ? (item.backdropUrl ?? item.posterUrl)?.replace("/original/", "/w780/") : item.posterUrl} fallbackUrls={item.posterFallbackUrls}/><div className="discovery-card-shade"/>{landscape && <span className="coming-soon-badge">Coming soon</span>}<span className="card-open-icon"><ArrowRight size={17}/></span>{!artist && <div className="discovery-card-overlay"><strong>{item.title}</strong><span>{item.displayDate}{item.voteAverage ? ` · ★ ${item.voteAverage.toFixed(1)}` : ""}</span></div>}</div>
      {(item.type === "GAME" || item.type === "MUSIC" || landscape) && <div className="discovery-card-caption"><strong>{item.title}</strong><span>{item.artistName ?? item.displayDate}</span></div>}
    </Link>
  </article>;
}
function CollectionRow({ state, row, returnTo, onViewAll, eager = false }: { state: DiscoveryState; row: ReturnType<typeof discoveryRows>[number]; returnTo: string; onViewAll: () => void; eager?: boolean }) {
  const [visible, setVisible] = useState(eager);
  const container = useRef<HTMLElement>(null);
  const key = collectionKey({ ...state, sort: row.sort, genre: row.genre, q: "", all: false });
  const result = useDiscoveryCollection(key, visible);
  const landscape = row.sort === "upcoming" && state.type !== "MUSIC";
  useEffect(() => {
    if (visible || !container.current) return;
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } }, { rootMargin: "600px" });
    observer.observe(container.current);
    return () => observer.disconnect();
  }, [visible]);
  return <section ref={container} className="discovery-row" aria-label={row.label}>
    <div className="discovery-row-heading"><h3>{row.label}</h3><button type="button" className="row-view-all" onClick={onViewAll}>View all <ArrowRight size={14}/></button></div>
    {result.error ? <div className="collection-message" role="status"><span>{result.error}</span><button type="button" onClick={result.retry}>Try again</button></div> : !result.data ? <SkeletonCards landscape={landscape}/> : result.data.items.length ? <ScrollRail label={row.label} trackClassName="discovery-row-track">{result.data.items.slice(0, 20).map((item) => <DiscoveryCard key={`${item.source}:${item.sourceId}`} item={item} returnTo={returnTo} landscape={landscape}/>)}</ScrollRail> : <p className="collection-message">{row.sort === "upcoming" ? "No announced releases are available for this collection yet." : "This collection has no titles right now."}</p>}
  </section>;
}
function FilterSelect({ label, value, onChange, options, disabled = false }: { label: string; value: string; onChange: (value: string) => void; options: { value: string; label: string }[]; disabled?: boolean }) {
  return <label className="discovery-select"><span className="sr-only">{label}</span><select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><ChevronDown size={14}/></label>;
}
export function ExploreFeed({ initialState }: { initialState: DiscoveryState }) {
  const [state, setState] = useState(initialState);
  const [search, setSearch] = useState(initialState.q);
  const [recent, setRecent] = useState<RecentSearch[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [image, setImage] = useState<string | null>(null);
  const [featured, setFeatured] = useState<{ key: string; items: RadarItem[] } | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [providers, setProviders] = useState<{ key: string; items: Provider[] } | null>(null);
  const [randomLoading, setRandomLoading] = useState(false);
  const searchRoot = useRef<HTMLFormElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const spotify = useSpotifyConnected();
  const spotifySearch = state.type === "MUSIC" && !!state.q && spotify;
  const key = collectionKey(state);
  const result = useDiscoveryCollection(key, !spotifySearch);
  const returnTo = `/discover?${discoveryQuery(state)}`;
  const providerKey = `${state.type}:${state.country}`;
  const providerList = providers?.key === providerKey ? providers.items : [];
  const category = mediaCategories.find((entry) => entry.value === state.type)!;
  const rows = discoveryRows(state.type);
  const isExpanded = state.all || !!state.q;
  const heroItems = featured?.key === key ? featured.items : result.data?.items ?? [];
  const collectionTitle = state.q ? `Results for “${state.q}”` : state.genre ? discoverShelves[state.type].find((entry) => entry.value === state.genre)?.label ?? category.label : rows.find((row) => row.sort === state.sort && !row.genre)?.label ?? category.label;
  const years = Array.from({ length: new Date().getFullYear() - 1900 + 4 }, (_, index) => { const value = String(new Date().getFullYear() + 3 - index); return { value, label: value }; });
  const sorts = state.type === "MUSIC" ? [{ value: "popular", label: "Popular albums" }, { value: "songs", label: "Popular songs" }, { value: "artists", label: "Artists" }, { value: "new", label: "Recent chart releases" }, { value: "upcoming", label: "Upcoming" }] : [{ value: "popular", label: "Popular" }, { value: "rated", label: "Top rated" }, ...(state.type === "GAME" ? [] : [{ value: "now", label: state.type === "MOVIE" ? "In theaters" : "On the air" }]), { value: "upcoming", label: "Upcoming" }];
  useEffect(() => {
    if (state.type === "MUSIC" || isExpanded) return;
    const controller = new AbortController();
    void fetch(`/api/discover/featured?${new URLSearchParams({ type: state.type, country: state.country })}`, { signal: controller.signal }).then((response) => response.ok ? response.json() : null).then((data: { items: RadarItem[] } | null) => { if (data?.items.length && !controller.signal.aborted) setFeatured({ key, items: data.items }); }).catch(() => undefined);
    return () => controller.abort();
  }, [key, state.type, state.country, isExpanded]);
  useEffect(() => {
    const onPop = () => { const next = discoveryState(new URLSearchParams(window.location.search)); setState(next); setSearch(next.q); };
    const onScroll = () => setScrolled(window.scrollY > 48);
    window.addEventListener("popstate", onPop); window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => { window.removeEventListener("popstate", onPop); window.removeEventListener("scroll", onScroll); };
  }, []);
  useEffect(() => {
    if (state.type !== "MOVIE" && state.type !== "SHOW") return;
    let cancelled = false;
    void fetch(`/api/discover/providers?${new URLSearchParams({ type: state.type, country: state.country })}`).then((response) => response.json()).then((data: { providers: Provider[] }) => { if (!cancelled) setProviders({ key: providerKey, items: data.providers }); }).catch(() => { if (!cancelled) setProviders({ key: providerKey, items: [] }); });
    return () => { cancelled = true; };
  }, [providerKey, state.type, state.country]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const query = search.trim().slice(0, 80);
      if (query !== state.q) {
        const next = { ...state, q: query, genre: "", year: "", provider: "", sort: "popular", all: query.length > 0 };
        setState(next); window.history.replaceState(null, "", `/discover?${discoveryQuery(next)}`);
      }
    }, 400);
    return () => window.clearTimeout(timer);
  }, [search, state]);
  useEffect(() => {
    if (!state.q || state.q.length < 2) return;
    const timer = window.setTimeout(() => {
      const entries = [{ q: state.q, type: state.type }, ...readRecent().filter((entry) => entry.q.toLowerCase() !== state.q.toLowerCase() || entry.type !== state.type)].slice(0, 8);
      try { localStorage.setItem(recentKey, JSON.stringify(entries)); } catch { /* Browsing still works when storage is unavailable. */ }
      setRecent(entries);
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [state.q, state.type]);
  useEffect(() => {
    if (!searchOpen) return;
    const close = (event: PointerEvent) => { if (!searchRoot.current?.contains(event.target as Node)) setSearchOpen(false); };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [searchOpen]);
  function navigate(next: DiscoveryState, scroll = true) {
    setState(next); setSearch(next.q); setSearchOpen(false);
    window.history.pushState(null, "", `/discover?${discoveryQuery(next)}`);
    if (scroll) window.scrollTo({ top: 0, behavior: "instant" });
  }
  function chooseFilter(field: "genre" | "year" | "sort" | "provider" | "country", value: string) {
    navigate({ ...state, [field]: value, ...(field === "country" ? { provider: "" } : {}), all: true });
  }
  function rememberSearch() {
    if (!search.trim()) return;
    const next = { ...state, q: search.trim(), all: true };
    navigate(next);
    searchInput.current?.blur();
  }
  async function randomTitle() {
    setRandomLoading(true);
    try {
      const next = await fetchCollection(key, state.type === "MUSIC" ? 1 : 1 + Math.floor(Math.random() * 4));
      const items = next.items.length ? next.items : result.data?.items ?? [];
      if (items.length) router.push(detailLink(items[Math.floor(Math.random() * items.length)], returnTo));
    } catch { const items = result.data?.items ?? []; if (items.length) router.push(detailLink(items[Math.floor(Math.random() * items.length)], returnTo)); }
    finally { setRandomLoading(false); }
  }
  const musicFallback = <>{result.data?.items.some((item) => item.source === "apple-song") && <section className="mb-9"><h3 className="mb-4 text-xl font-semibold">Songs</h3><MusicTrackList returnTo={returnTo} tracks={result.data.items.filter((item) => item.source === "apple-song").slice(0, 12).map((item) => ({ title: item.title, artist: item.artistName, artworkUrl: item.posterUrl, internalHref: item.href }))}/></section>}<div className="discovery-grid" data-type={state.type}>{result.data?.items.map((item) => <DiscoveryCard key={`${item.source}:${item.sourceId}`} item={item} returnTo={returnTo}/>)}</div></>;
  return <main className={`discovery-page ${isExpanded ? "discovery-expanded" : ""}`} data-type={state.type}>
    {isExpanded ? <CatalogAtmosphere/> : <div className="discovery-artwork-haze" style={image ? { backgroundImage: `url("${image}")` } : undefined} aria-hidden="true"/>}
    <header className={`discovery-header ${scrolled || isExpanded ? "header-solid" : ""}`}>
      <nav className="discovery-categories" aria-label="Media categories">{mediaCategories.map((entry) => <button key={entry.value} type="button" aria-current={state.type === entry.value ? "page" : undefined} onClick={() => navigate({ ...defaultDiscovery, type: entry.value, country: state.country })}>{entry.label}</button>)}</nav>
      <form ref={searchRoot} role="search" className="discovery-search" onSubmit={(event) => { event.preventDefault(); rememberSearch(); }} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setSearchOpen(false); }}>
        <Search size={17} aria-hidden="true"/><input ref={searchInput} value={search} onChange={(event) => setSearch(event.target.value)} onFocus={() => { setRecent(readRecent()); setSearchOpen(true); }} onKeyDown={(event) => { if (event.key === "Escape") { setSearchOpen(false); searchInput.current?.blur(); } if (event.key === "ArrowDown" && searchOpen) { event.preventDefault(); searchRoot.current?.querySelector<HTMLButtonElement>(".recent-search-item")?.focus(); } }} aria-label={`Search ${category.label.toLowerCase()}`} aria-controls="recent-searches" placeholder={`Search ${category.label.toLowerCase()}`} autoComplete="off" maxLength={80}/>{search && <button type="button" className="search-clear" aria-label="Clear search" onClick={() => { setSearch(""); navigate({ ...defaultDiscovery, type: state.type, country: state.country }); searchInput.current?.focus(); }}><X size={15}/></button>}
        {searchOpen && <div className="recent-search-popup" id="recent-searches"><div className="recent-search-heading"><span>Recent searches</span>{recent.length > 0 && <button type="button" onClick={() => { try { localStorage.removeItem(recentKey); } catch {} setRecent([]); }}>Clear</button>}</div>{recent.length ? recent.filter((entry) => !search || entry.q.toLowerCase().includes(search.toLowerCase())).map((entry, index) => <button key={`${entry.type}:${entry.q}`} type="button" className="recent-search-item" onClick={() => navigate({ ...defaultDiscovery, type: entry.type, q: entry.q, country: state.country, all: true })} onKeyDown={(event) => { const buttons = searchRoot.current?.querySelectorAll<HTMLButtonElement>(".recent-search-item"); if (event.key === "ArrowDown") { event.preventDefault(); buttons?.[Math.min(index + 1, buttons.length - 1)]?.focus(); } if (event.key === "ArrowUp") { event.preventDefault(); if (!index) searchInput.current?.focus(); else buttons?.[index - 1]?.focus(); } if (event.key === "Escape") { searchInput.current?.focus(); setSearchOpen(false); } }}><Clock3 size={14}/><span>{entry.q}</span><small>{mediaCategories.find((type) => type.value === entry.type)?.label}</small><ArrowUpRightIcon/></button>) : <p>Your recent searches will appear here.</p>}</div>}
      </form>
    </header>
    {!isExpanded && <CinematicHero key={state.type} items={heroItems} market={state.country} returnTo={returnTo} onFeature={setImage}/>}
    <div className="discovery-content" id="discover-collections">
      <div className="discovery-content-heading">{isExpanded ? <div><button type="button" className="collection-back" onClick={() => navigate({ ...defaultDiscovery, type: state.type, country: state.country })}><ArrowLeft size={15}/> Back to {category.label.toLowerCase()}</button><h1>{collectionTitle}</h1></div> : <div><h2>{category.label}</h2></div>}{isExpanded && <span className="result-count">{result.data?.items.length ?? 0} titles{result.data?.hasMore ? " & counting" : ""}</span>}</div>
      <div className="discovery-filter-wrapper"><div className="discovery-filters" aria-label="Browse filters">
        <button type="button" className="random-title" title="Pick a random title" aria-label="Pick a random title" disabled={randomLoading || !result.data?.items.length} onClick={() => void randomTitle()}><Shuffle size={17} className={randomLoading ? "animate-pulse" : ""}/></button>
        <FilterSelect label="Genre" value={state.genre} disabled={!!state.q} onChange={(value) => chooseFilter("genre", value)} options={[{ value: "", label: "Genre" }, ...discoverShelves[state.type]]}/>
        <FilterSelect label={state.type === "MUSIC" ? "Chart release year" : "Year"} value={state.year} disabled={!!state.q} onChange={(value) => chooseFilter("year", value)} options={[{ value: "", label: state.type === "MUSIC" ? "Release year" : "Year" }, ...years]}/>
        <FilterSelect label="Sort" value={sorts.some((entry) => entry.value === state.sort) ? state.sort : "popular"} disabled={!!state.q} onChange={(value) => chooseFilter("sort", value)} options={sorts}/>
        {(state.type === "MOVIE" || state.type === "SHOW") && <FilterSelect label="Provider" value={state.provider} disabled={!!state.q} onChange={(value) => chooseFilter("provider", value)} options={[{ value: "", label: "Provider" }, ...providerList.map((provider) => ({ value: provider.id, label: provider.name }))]}/>}
        <FilterSelect label={state.type === "MUSIC" ? "Music market" : "Country"} value={state.country} onChange={(value) => chooseFilter("country", value)} options={countries}/>
        {isExpanded && !state.q && <button type="button" className="filter-reset" onClick={() => navigate({ ...defaultDiscovery, type: state.type, country: state.country })}>Reset</button>}
      </div></div>
      {!!state.q && <p className="search-scope">Searching {category.label.toLowerCase()}. Browse filters are available when you clear the search.</p>}
      {!isExpanded && (state.type === "MOVIE" || state.type === "SHOW") && providerList.length > 0 && <section className="provider-shelf" aria-label="Browse by provider"><div className="discovery-row-heading"><h3>Browse by provider</h3><span className="provider-region">{countries.find((country) => country.value === state.country)?.label}</span></div><ScrollRail label="providers" trackClassName="provider-track">{providerList.map((provider) => <button key={provider.id} type="button" onClick={() => navigate({ ...defaultDiscovery, type: state.type, country: state.country, provider: provider.id, all: true })}><div>{provider.logo ? <Image src={provider.logo} alt="" width={60} height={60} sizes="60px"/> : <span className="provider-letter">{provider.name.slice(0, 1)}</span>}</div><span>{provider.name}</span></button>)}</ScrollRail></section>}
      {isExpanded ? <section className="expanded-results" aria-label={collectionTitle} aria-busy={result.loading}>
        {result.error && <div role="status" className="collection-message"><span>{result.error}</span><button type="button" onClick={result.retry}>Try again</button></div>}
        {result.loading && !spotifySearch && <div className="discovery-grid" data-type={state.type}>{Array.from({ length: 12 }, (_, index) => <div key={index} className="discovery-skeleton"/>)}</div>}
        {spotifySearch ? <SpotifySearchResults key={`${state.country}:${state.q}`} query={state.q} market={state.country} returnTo={returnTo} fallback={musicFallback}/> : musicFallback}
        {result.data && !result.data.items.length && !spotifySearch && <div className="discovery-empty"><Sparkles size={26}/><h3>No matches this time</h3><p>Try a different search or loosen a filter to explore more titles.</p><button type="button" onClick={() => navigate({ ...defaultDiscovery, type: state.type, country: state.country })}>Explore {category.label.toLowerCase()}</button></div>}
        {result.data?.hasMore && !spotifySearch && <div className="load-more-wrap"><button type="button" disabled={result.more} onClick={() => void result.loadMore()}>{result.more ? "Loading more…" : "Explore more"}<ArrowDownIcon/></button></div>}
      </section> : <div className="discovery-collections">{result.error && <div role="status" className="collection-message"><span>{result.error}</span><button type="button" onClick={result.retry}>Try again</button></div>}{rows.map((row, index) => <CollectionRow key={`${state.type}:${state.country}:${row.value}`} state={state} row={row} eager={index < 2} returnTo={returnTo} onViewAll={() => navigate({ ...state, genre: row.genre, sort: row.sort, all: true })}/>)}</div>}
      <footer className="discovery-footer"><span className="horizon-wordmark">horizon<span className="wordmark-dot">.</span></span><p>One place for everything you love.</p><span>{state.type === "MUSIC" ? "Catalog data: Apple / MusicBrainz · Playback: Spotify" : state.type === "GAME" ? "Game information from Steam and RAWG" : "Film and TV information from TMDB · Availability by JustWatch"}</span></footer>
    </div>
  </main>;
}
function ArrowUpRightIcon() { return <span aria-hidden="true">↗</span>; }
function ArrowDownIcon() { return <ChevronDown size={16}/>; }
