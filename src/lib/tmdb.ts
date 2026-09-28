import "server-only";

const TMDB_API = "https://api.themoviedb.org/3";
const IMAGE_BASE = "https://image.tmdb.org/t/p";

export type TmdbMovie = {
  id: number;
  title: string;
  original_title: string;
  overview: string;
  release_date: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  genre_ids?: number[];
  genres?: { id: number; name: string }[];
  popularity?: number;
};

export type TmdbShow = {
  id: number;
  name: string;
  original_name: string;
  overview: string;
  first_air_date: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  genre_ids?: number[];
  genres?: { id: number; name: string }[];
  popularity?: number;
};

export type TmdbPerson = {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
};

export type TmdbVideo = {
  id: string;
  key: string;
  name: string;
  site: string;
  type: string;
  official: boolean;
};

export type TmdbMovieDetails = TmdbMovie & {
  credits?: { cast: TmdbPerson[] };
  videos?: { results: TmdbVideo[] };
};

export type TmdbShowDetails = TmdbShow & {
  credits?: { cast: TmdbPerson[] };
  videos?: { results: TmdbVideo[] };
};

type TmdbList<T> = { results: T[]; total_pages?: number };

export async function tmdbFetch<T>(path: string, query: Record<string, string> = {}): Promise<T> {
  const apiKey = process.env.TMDB_API_KEY;
  const readToken = process.env.TMDB_READ_ACCESS_TOKEN;
  if (!apiKey && !readToken) throw new Error("TMDB credentials are not configured.");

  const url = new URL(`${TMDB_API}${path}`);
  url.searchParams.set("language", "en-US");
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
  if (apiKey) url.searchParams.set("api_key", apiKey);

  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      ...(readToken ? { Authorization: `Bearer ${readToken}` } : {}),
    },
    next: { revalidate: 3600 },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`TMDB request failed (${response.status}).`);
  return response.json() as Promise<T>;
}

function dateRange() {
  const start = new Date();
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 18);
  const iso = (date: Date) => date.toISOString().slice(0, 10);
  return { today: iso(start), futureLimit: iso(end) };
}

async function paginated<T>(path: string, query: Record<string, string>, pageCount = 3): Promise<T[]> {
  const pages = await Promise.all(Array.from({ length: pageCount }, (_, index) =>
    tmdbFetch<TmdbList<T>>(path, { ...query, page: String(index + 1) }).catch(() => ({ results: [] as T[] })),
  ));
  return pages.flatMap((page) => page.results ?? []);
}

export async function getUpcomingMovies(): Promise<TmdbMovie[]> {
  try {
    const { today, futureLimit } = dateRange();
    const movies = await paginated<TmdbMovie>("/discover/movie", {
      include_adult: "false",
      include_video: "false",
      region: "US",
      "primary_release_date.gte": today,
      "primary_release_date.lte": futureLimit,
      sort_by: "primary_release_date.asc",
    });
    return movies
      .filter((movie) => movie.release_date >= today && movie.release_date <= futureLimit)
      .sort((a, b) => a.release_date.localeCompare(b.release_date));
  } catch {
    return [];
  }
}

export async function getUpcomingShows(): Promise<TmdbShow[]> {
  try {
    const { today, futureLimit } = dateRange();
    const shows = await paginated<TmdbShow>("/discover/tv", {
      include_null_first_air_dates: "false",
      "first_air_date.gte": today,
      "first_air_date.lte": futureLimit,
      sort_by: "first_air_date.asc",
    });
    return shows
      .filter((show) => show.first_air_date >= today && show.first_air_date <= futureLimit)
      .sort((a, b) => a.first_air_date.localeCompare(b.first_air_date));
  } catch {
    return [];
  }
}

export async function getMovieDetails(id: number): Promise<TmdbMovieDetails | null> {
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  try {
    return await tmdbFetch<TmdbMovieDetails>(`/movie/${id}`, { append_to_response: "credits,videos" });
  } catch {
    return null;
  }
}

export async function getShowDetails(id: number): Promise<TmdbShowDetails | null> {
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  try {
    return await tmdbFetch<TmdbShowDetails>(`/tv/${id}`, { append_to_response: "credits,videos" });
  } catch {
    return null;
  }
}

export function tmdbImage(path: string | null, size: "w185" | "w342" | "w500" | "w780" | "original" = "w500") {
  return path ? `${IMAGE_BASE}/${size}${path}` : null;
}
