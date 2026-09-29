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
  vote_count?: number;
  genre_ids?: number[];
  genres?: { id: number; name: string }[];
  popularity?: number;
  original_language?: string;
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
  vote_count?: number;
  genre_ids?: number[];
  genres?: { id: number; name: string }[];
  popularity?: number;
  original_language?: string;
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
  runtime?: number | null;
  tagline?: string;
  original_language?: string;
  production_companies?: { id: number; name: string; logo_path: string | null }[];
  credits?: { cast: TmdbPerson[] };
  videos?: { results: TmdbVideo[] };
  images?: { logos: { file_path: string; iso_639_1: string | null }[] };
  genres?: { id: number; name: string }[];
  release_dates?: { results: { iso_3166_1: string; release_dates: { certification: string; release_date: string; type: number }[] }[] };
};

export type TmdbShowDetails = TmdbShow & {
  number_of_seasons?: number;
  number_of_episodes?: number;
  status?: string;
  credits?: { cast: TmdbPerson[] };
  videos?: { results: TmdbVideo[] };
  images?: { logos: { file_path: string; iso_639_1: string | null }[] };
  genres?: { id: number; name: string }[];
};

export type TmdbList<T> = { results: T[]; total_pages?: number };

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
      with_origin_country: "US",
      with_original_language: "en",
      "with_runtime.gte": "60",
      "primary_release_date.gte": today,
      "primary_release_date.lte": futureLimit,
      sort_by: "popularity.desc",
    }, 5);
    return movies
      .filter((movie) => movie.release_date >= today && movie.release_date <= futureLimit)
      // Keep the calendar centered on widely announced releases and drop community spam.
      .filter((movie) => movie.original_language === "en" && Boolean(movie.poster_path))
      .filter((movie) => (movie.popularity ?? 0) >= 2 || (movie.vote_count ?? 0) >= 10)
      .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0));
  } catch {
    return [];
  }
}

export async function getUpcomingShows(): Promise<TmdbShow[]> {
  try {
    const { today, futureLimit } = dateRange();
    const shows = await paginated<TmdbShow>("/discover/tv", {
      include_null_first_air_dates: "false",
      with_origin_country: "US",
      with_original_language: "en",
      "first_air_date.gte": today,
      "first_air_date.lte": futureLimit,
      sort_by: "popularity.desc",
    }, 5);
    return shows
      .filter((show) => show.first_air_date >= today && show.first_air_date <= futureLimit)
      .filter((show) => show.original_language === "en" && Boolean(show.poster_path))
      .filter((show) => (show.popularity ?? 0) >= 1.5 || (show.vote_count ?? 0) >= 8)
      .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0));
  } catch {
    return [];
  }
}

export async function getMovieDetails(id: number): Promise<TmdbMovieDetails | null> {
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  try {
    return await tmdbFetch<TmdbMovieDetails>(`/movie/${id}`, { append_to_response: "credits,videos,images,release_dates" });
  } catch {
    return null;
  }
}

export async function getShowDetails(id: number): Promise<TmdbShowDetails | null> {
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  try {
    return await tmdbFetch<TmdbShowDetails>(`/tv/${id}`, { append_to_response: "credits,videos,images" });
  } catch {
    return null;
  }
}

export async function getExploreMovies(options: { genreId?: number; year?: number; sort?: "popular" | "rated"; page?: number } = {}): Promise<TmdbMovie[]> {
  const query: Record<string, string> = {
    include_adult: "false",
    include_video: "false",
    region: "US",
    with_origin_country: "US",
    with_original_language: "en",
    sort_by: options.sort === "rated" ? "vote_average.desc" : "popularity.desc",
    // Crowd signal keeps spammy and synthetic catalogue entries out of exploration.
    "vote_count.gte": options.sort === "rated" ? "50" : "10",
    ...(options.genreId ? { with_genres: String(options.genreId) } : {}),
    ...(options.year ? { primary_release_year: String(options.year) } : {}),
    page: String(Math.min(20, Math.max(1, options.page ?? 1))),
  };
  const result = await tmdbFetch<TmdbList<TmdbMovie>>("/discover/movie", query);
  return (result.results ?? []).filter((movie) => movie.original_language === "en" && Boolean(movie.poster_path));
}

export async function getExploreShows(options: { genreId?: number; year?: number; sort?: "popular" | "rated"; page?: number } = {}): Promise<TmdbShow[]> {
  const query: Record<string, string> = {
    include_null_first_air_dates: "false",
    with_origin_country: "US",
    with_original_language: "en",
    sort_by: options.sort === "rated" ? "vote_average.desc" : "popularity.desc",
    "vote_count.gte": options.sort === "rated" ? "30" : "8",
    ...(options.genreId ? { with_genres: String(options.genreId) } : {}),
    ...(options.year ? { first_air_date_year: String(options.year) } : {}),
    page: String(Math.min(20, Math.max(1, options.page ?? 1))),
  };
  const result = await tmdbFetch<TmdbList<TmdbShow>>("/discover/tv", query);
  return (result.results ?? []).filter((show) => show.original_language === "en" && Boolean(show.poster_path));
}

export function tmdbImage(path: string | null, size: "w185" | "w342" | "w500" | "w780" | "original" = "w500") {
  return path ? `${IMAGE_BASE}/${size}${path}` : null;
}
