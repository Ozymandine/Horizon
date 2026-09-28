import "server-only";

import type { TmdbWatchOptions } from "@/lib/tmdb-watch-types";

const TMDB_API = "https://api.themoviedb.org/3";

export async function getMovieWatchOptions(id: number): Promise<TmdbWatchOptions | null> {
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  const apiKey = process.env.TMDB_API_KEY;
  const readToken = process.env.TMDB_READ_ACCESS_TOKEN;
  if (!apiKey && !readToken) return null;

  const url = new URL(`${TMDB_API}/movie/${id}/watch/providers`);
  if (apiKey) url.searchParams.set("api_key", apiKey);
  try {
    const response = await fetch(url, {
      headers: readToken ? { Authorization: `Bearer ${readToken}`, accept: "application/json" } : { accept: "application/json" },
      next: { revalidate: 3600 },
    });
    if (!response.ok) return null;
    const data = await response.json() as { results?: Record<string, TmdbWatchOptions> };
    return data.results?.US ?? null;
  } catch {
    return null;
  }
}
