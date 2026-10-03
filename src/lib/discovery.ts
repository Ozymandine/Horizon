import "server-only";
import { tmdbFetch, tmdbImage, type TmdbList, type TmdbMovie, type TmdbShow } from "@/lib/tmdb";
import { getUpcomingAlbums, parseSteamCards, type RadarItem } from "@/lib/radar";
import { musicChart, searchMusicCatalog } from "@/lib/music-catalog";
import type { DiscoveryState } from "@/lib/discovery-options";
import { isExplicitlyAiGenerated } from "@/lib/media-quality";
import { watchService, watchServices } from "@/lib/watch-services";
import { filmSearch } from "@/lib/film-search";

export type DiscoveryPage = { items: RadarItem[]; hasMore: boolean };
export type DiscoveryProvider = { id: string; name: string; logo: string | null };
const pageSize = 24;
const dateLabel = (date: string) => date ? new Date(`${date.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }) : "Release date TBA";
const safePage = (page: number) => Math.min(500, Math.max(1, Number.isSafeInteger(page) ? page : 1));

function filmItem(entry: TmdbMovie | TmdbShow, type: "MOVIE" | "SHOW"): RadarItem {
  const movie = "title" in entry;
  const date = (movie ? entry.release_date : entry.first_air_date) || "";
  const title = movie ? entry.title : entry.name;
  return {
    source: "tmdb", sourceId: String(entry.id), type, title,
    displayDate: dateLabel(date), releaseDate: date || null,
    sortTimestamp: date ? `${date}T12:00:00.000Z` : null, isApproximate: !date,
    posterUrl: tmdbImage(entry.poster_path), backdropUrl: tmdbImage(entry.backdrop_path, "original"),
    description: entry.overview, externalUrl: null, tmdbId: entry.id, genreIds: entry.genre_ids ?? [],
    popularity: entry.popularity ?? 0, voteAverage: entry.vote_average, voteCount: entry.vote_count ?? 0,
    ratingScale: 10, ratingSource: "TMDB", href: `/${movie ? "movies" : "shows"}/${entry.id}`,
  };
}

async function filmPage(state: DiscoveryState, page: number): Promise<DiscoveryPage> {
  const movie = state.type === "MOVIE";
  const kind = movie ? "movie" : "tv";
  const today = new Date().toISOString().slice(0, 10);
  const query: Record<string, string> = { page: String(page), include_adult: "false" };
  const categorySearch = filmSearch(state.q, movie ? "MOVIE" : "SHOW");
  let path = `/discover/${kind}`;
  if (state.q && !categorySearch) {
    path = `/search/${kind}`;
    query.query = state.q;
    if (movie) query.region = state.country;
    if (state.year) query[movie ? "primary_release_year" : "first_air_date_year"] = state.year;
  } else {
    query.sort_by = state.sort === "rated" ? "vote_average.desc" : "popularity.desc";
    if (movie) { query.include_video = "false"; query.region = state.country; }
    else query.include_null_first_air_dates = "false";
    if (!movie && !["10763", "10767"].includes(state.genre)) query.without_genres = "10763,10767";
    const genres = [...new Set([...(categorySearch?.genres ?? []), ...(state.genre ? [state.genre] : [])])];
    if (genres.length) query.with_genres = genres.join(",");
    if (categorySearch?.keyword) query.with_keywords = categorySearch.keyword;
    const year = state.year || categorySearch?.year;
    if (year) query[movie ? "primary_release_year" : "first_air_date_year"] = year;
    if (state.sort === "rated") query["vote_count.gte"] = "200";
    if (state.provider) {
      query.with_watch_providers = watchService(Number(state.provider))?.ids.join("|") ?? state.provider;
      query.watch_region = state.country;
    }
    if (state.sort === "upcoming") {
      const end = new Date(); end.setUTCFullYear(end.getUTCFullYear() + 3);
      query[movie ? "primary_release_date.gte" : "first_air_date.gte"] = today;
      query[movie ? "primary_release_date.lte" : "first_air_date.lte"] = end.toISOString().slice(0, 10);
    }
    if (state.sort === "now") {
      const from = new Date(); from.setUTCDate(from.getUTCDate() - (movie ? 45 : 7));
      const to = new Date(); if (!movie) to.setUTCDate(to.getUTCDate() + 7);
      query[movie ? "release_date.gte" : "air_date.gte"] = from.toISOString().slice(0, 10);
      query[movie ? "release_date.lte" : "air_date.lte"] = to.toISOString().slice(0, 10);
      if (movie) query.with_release_type = "2|3";
      else query.timezone = "UTC";
    }
  }
  // Weekly trends avoid lifetime-popularity lists dominated by daily talk shows.
  if (!movie && !state.q && state.sort === "popular" && !state.genre && !state.year && !state.provider) path = "/trending/tv/week";
  const response = await tmdbFetch<TmdbList<TmdbMovie | TmdbShow>>(path, query);
  return {
    items: (response.results ?? []).filter((entry) => entry.poster_path && !(path === "/trending/tv/week" && entry.genre_ids?.some((id) => id === 10763 || id === 10767)) && !isExplicitlyAiGenerated("title" in entry ? entry.title : entry.name, entry.overview)).map((entry) => filmItem(entry, movie ? "MOVIE" : "SHOW")),
    hasMore: page < Math.min(500, response.total_pages ?? page),
  };
}

type RawgEntry = { id: number; slug: string; name: string; released?: string; background_image?: string; rating?: number; ratings_count?: number; metacritic?: number; genres?: { name: string }[]; short_screenshots?: { image: string }[] };
const rawgGenre: Record<string, string> = { "tag:19": "action", "tag:21": "adventure", "tag:122": "role-playing-games-rpg", "tag:9": "strategy", "tag:599": "simulation" };
async function rawgPage(state: DiscoveryState, page: number): Promise<DiscoveryPage | null> {
  const key = process.env.RAWG_API_KEY;
  if (!key) return null;
  const query = new URLSearchParams({ key, page: String(page), page_size: "40", ordering: state.sort === "rated" ? "-rating" : "-added" });
  if (state.q) { query.set("search", state.q); query.set("search_precise", "true"); }
  else {
    if (rawgGenre[state.genre]) query.set("genres", rawgGenre[state.genre]);
    if (state.year) query.set("dates", `${state.year}-01-01,${state.year}-12-31`);
    if (state.sort === "upcoming") {
      const end = new Date(); end.setUTCFullYear(end.getUTCFullYear() + 3);
      const today = new Date().toISOString().slice(0, 10);
      const from = state.year ? [today, `${state.year}-01-01`].sort().at(-1)! : today;
      const to = state.year ? [end.toISOString().slice(0, 10), `${state.year}-12-31`].sort()[0] : end.toISOString().slice(0, 10);
      if (from > to) return { items: [], hasMore: false };
      query.set("dates", `${from},${to}`);
      query.set("ordering", "-added");
    }
  }
  const response = await fetch(`https://api.rawg.io/api/games?${query}`, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(9000) });
  if (!response.ok) return null;
  const data = await response.json() as { results?: RawgEntry[]; next?: string | null };
  return { items: (data.results ?? []).filter((entry) => entry.id && entry.slug && entry.name && entry.background_image && !isExplicitlyAiGenerated(entry.name)).map((entry): RadarItem => ({
    source: "rawg", sourceId: String(entry.id), type: "GAME", title: entry.name,
    displayDate: dateLabel(entry.released ?? ""), releaseDate: entry.released ?? null,
    sortTimestamp: entry.released ? `${entry.released}T12:00:00.000Z` : null, isApproximate: !entry.released,
    posterUrl: entry.background_image ?? null, posterFallbackUrls: entry.short_screenshots?.map((shot) => shot.image), backdropUrl: entry.background_image ?? null,
    description: `Explore ${entry.name}.`, tags: entry.genres?.map((genre) => genre.name), externalUrl: null, tmdbId: null, genreIds: [],
    popularity: entry.ratings_count ?? 0, voteAverage: entry.rating ?? 0, voteCount: entry.ratings_count ?? 0, ratingScale: 5, ratingSource: "RAWG", href: `/releases/rawg/${entry.slug}`,
  })), hasMore: Boolean(data.next) };
}

async function gamePage(state: DiscoveryState, page: number): Promise<DiscoveryPage> {
  // RAWG supports exact release-year filtering and broad catalog text search.
  if (state.q || state.year) {
    const result = await rawgPage(state, page).catch(() => null);
    if (result) return result;
  }
  const offset = (page - 1) * 50;
  const tag = state.genre.match(/^tag:(\d+)$/)?.[1];
  const query = new URLSearchParams({ term: state.q, start: String(offset), count: "50", infinite: "1", cc: state.country.toLowerCase(), l: "english", category1: "998", sort_by: state.sort === "rated" ? "Reviews_DESC" : "_ASC" });
  if (tag && !state.q) query.set("tags", tag);
  if (!state.q && state.sort !== "rated") query.set("filter", state.sort === "upcoming" ? "popularcomingsoon" : "topsellers");
  const response = await fetch(`https://store.steampowered.com/search/results/?${query}`, { headers: { accept: "application/json", "user-agent": "HorizonReleaseRadar/1.0" }, next: { revalidate: 3600 }, signal: AbortSignal.timeout(9000) });
  if (!response.ok) {
    const fallback = await rawgPage(state, page);
    if (fallback) return fallback;
    throw new Error("Game discovery is temporarily unavailable.");
  }
  const data = await response.json() as { results_html?: string; total_count?: number };
  const parsed = parseSteamCards(data.results_html ?? "", { offset, upcomingOnly: state.sort === "upcoming" });
  return { items: parsed.filter((item) => !state.year || item.sortTimestamp?.slice(0, 4) === state.year), hasMore: offset + 50 < (data.total_count ?? 0) };
}

export async function getDiscoveryPage(state: DiscoveryState, requestedPage = 1): Promise<DiscoveryPage> {
  const page = safePage(requestedPage);
  if (state.type === "MOVIE" || state.type === "SHOW") return filmPage(state, page);
  if (state.type === "GAME") return gamePage(state, page);
  let items: RadarItem[];
  if (state.q) items = await searchMusicCatalog(state.q, state.country);
  else if (state.sort === "upcoming") items = await getUpcomingAlbums(state.country, state.genre);
  else items = await musicChart(state.sort, state.genre, state.country);
  if (state.year) items = items.filter((item) => item.releaseDate?.slice(0, 4) === state.year);
  if (state.sort === "new") items.sort((a, b) => (b.releaseDate ?? "").localeCompare(a.releaseDate ?? ""));
  const start = (page - 1) * pageSize;
  return { items: items.slice(start, start + pageSize), hasMore: start + pageSize < items.length };
}

export async function getDiscoveryProviders(type: "MOVIE" | "SHOW", country: string): Promise<DiscoveryProvider[]> {
  const result = await tmdbFetch<{ results?: { provider_id: number; provider_name: string; logo_path: string | null; display_priority?: number }[] }>(`/watch/providers/${type === "MOVIE" ? "movie" : "tv"}`, { watch_region: country });
  return watchServices.flatMap((service) => {
    const entry = service.ids.map((id) => result.results?.find((provider) => provider.provider_id === id)).find(Boolean);
    return entry ? [{ id: String(entry.provider_id), name: service.name, logo: tmdbImage(entry.logo_path, "w185") }] : [];
  });
}
