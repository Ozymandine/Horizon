import type { TmdbMovieDetails, TmdbSeasonDetails, TmdbShowDetails } from "./tmdb";

export type PlaybackSeason = { season: number; name: string; episodeCount: number };
export type PlaybackCatalog = {
  title: string;
  overview: string;
  year: string;
  runtime: number | null;
  rating: number | null;
  certification: string;
  logoUrl: string | null;
  posterUrl: string | null;
  backdropUrl: string | null;
  seasons: PlaybackSeason[];
};
export type PlaybackEpisode = { episode: number; title: string; overview: string; stillUrl: string | null; runtime: number | null; airDate: string | null };
export type PlaybackEpisodes = { season: number; episodes: PlaybackEpisode[] };

/** Query values can select a TMDB record, never a URL or arbitrary upstream path. */
export function playbackInteger(raw: string | null, min: number, max: number): number | null {
  if (raw === null || !/^(0|[1-9]\d{0,9})$/.test(raw)) return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value >= min && value <= max ? value : null;
}

function artwork(path: string | null | undefined, size: "w500" | "w780" | "w1280"): string | null {
  return typeof path === "string" && /^\/[A-Za-z0-9._-]{1,180}$/.test(path) ? `https://image.tmdb.org/t/p/${size}${path}` : null;
}

const minutes = (value: number | null | undefined) => Number.isFinite(value) && value! > 0 && value! <= 1440 ? value! : null;

export function playbackCatalog(details: TmdbMovieDetails | TmdbShowDetails): PlaybackCatalog {
  const movie = "title" in details ? details : null;
  const show = "name" in details ? details : null;
  const usDates = movie?.release_dates?.results?.find((region) => region.iso_3166_1 === "US")?.release_dates ?? [];
  const logo = details.images?.logos?.find((entry) => entry.iso_639_1 === "en") ?? details.images?.logos?.find((entry) => entry.iso_639_1 === null);
  const date = movie?.release_date ?? show?.first_air_date ?? "";
  const seasons = (show?.seasons ?? []).filter((season) => Number.isSafeInteger(season.season_number) && season.season_number >= 0 && season.season_number <= 1000 && season.episode_count > 0);
  return {
    title: movie?.title ?? show?.name ?? "",
    overview: details.overview ?? "",
    year: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date.slice(0, 4) : "",
    runtime: minutes(movie?.runtime ?? show?.episode_run_time?.[0]),
    rating: Number.isFinite(details.vote_average) && details.vote_average > 0 && details.vote_average <= 10 ? details.vote_average : null,
    certification: movie ? (usDates.find((entry) => entry.type === 3 && entry.certification)?.certification ?? usDates.find((entry) => entry.certification)?.certification ?? "") : (show?.content_ratings?.results?.find((region) => region.iso_3166_1 === "US")?.rating ?? ""),
    logoUrl: artwork(logo?.file_path, "w780"),
    posterUrl: artwork(details.poster_path, "w500"),
    backdropUrl: artwork(details.backdrop_path, "w1280"),
    seasons: [...new Map(seasons.map((season) => [season.season_number, { season: season.season_number, name: season.name || `Season ${season.season_number}`, episodeCount: Math.min(10000, Math.max(0, Math.floor(season.episode_count))) }])).values()].sort((a, b) => a.season - b.season),
  };
}

/** Keep the player payload compact and exclude invalid or repeated episode numbers. */
export function playbackEpisodes(details: TmdbSeasonDetails): PlaybackEpisodes {
  const episodes = (details.episodes ?? []).filter((episode) => Number.isSafeInteger(episode.episode_number) && episode.episode_number >= 1 && episode.episode_number <= 10000);
  return {
    season: details.season_number,
    episodes: [...new Map(episodes.map((episode) => [episode.episode_number, {
      episode: episode.episode_number,
      title: episode.name || `Episode ${episode.episode_number}`,
      overview: episode.overview ?? "",
      stillUrl: artwork(episode.still_path, "w780"),
      runtime: minutes(episode.runtime),
      airDate: typeof episode.air_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(episode.air_date) ? episode.air_date : null,
    }])).values()].sort((a, b) => a.episode - b.episode),
  };
}
