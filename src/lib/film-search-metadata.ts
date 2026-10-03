import "server-only";
import { tmdbFetch } from "@/lib/tmdb";
import { filmSearch, type FilmSearch } from "@/lib/film-search";

type NamedResults = { results?: { id: number; name: string }[] };
const normalized = (value: string) => value.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

// Resolve catalog metadata as well as title text, so new studios and topics do
// not require a new hardcoded alias. Ambiguous metadata stays a title search.
export async function resolveFilmSearch(query: string, type: "MOVIE" | "SHOW"): Promise<FilmSearch | null> {
  const known = filmSearch(query, type);
  if (known || !query.trim()) return known;
  const term = query.replace(/\b(?:movies?|films?|shows?|series)\b/gi, " ").trim();
  if (!term || term.length > 80) return null;
  const exact = normalized(term);
  const [studios, keywords] = await Promise.all([
    tmdbFetch<NamedResults>("/search/company", { query: term }).catch(() => null),
    tmdbFetch<NamedResults>("/search/keyword", { query: term }).catch(() => null),
  ]);
  const companyName = (value: string) => normalized(value).replace(/\b(?:studios?|pictures|productions?|entertainment|films?|inc|ltd)\b/g, "").replace(/\s+/g, " ").trim();
  const companies = studios?.results?.filter((entry) => normalized(entry.name) === exact || companyName(entry.name) === exact).map((entry) => String(entry.id));
  if (companies?.length) return { label: term, genres: [], companies };
  const topic = keywords?.results?.find((entry) => normalized(entry.name) === exact || normalized(entry.name) === exact.replace(/s$/, ""));
  if (!topic) return null;
  const count = await tmdbFetch<{ total_results?: number }>(`/discover/${type === "MOVIE" ? "movie" : "tv"}`, { with_keywords: String(topic.id), include_adult: "false" }).catch(() => null);
  return (count?.total_results ?? 0) >= 20 ? { label: topic.name, genres: [], keyword: String(topic.id) } : null;
}
