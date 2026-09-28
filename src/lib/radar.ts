import "server-only";
import { getUpcomingMovies, getUpcomingShows, tmdbImage } from "@/lib/tmdb";

export type RadarType = "MOVIE" | "SHOW" | "GAME" | "MUSIC";

export type RadarItem = {
  source: string;
  sourceId: string;
  type: RadarType;
  title: string;
  displayDate: string;
  releaseDate: string | null;
  sortTimestamp: string | null;
  isApproximate: boolean;
  posterUrl: string | null;
  backdropUrl: string | null;
  description: string;
  externalUrl: string | null;
  tmdbId: number | null;
  genreIds: number[];
  popularity: number;
  href: string;
};

function formatDate(value: string) {
  if (!value) return "Date TBA";
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric", timeZone: "UTC",
  });
}

export async function getUpcomingRadar(): Promise<Record<RadarType, RadarItem[]>> {
  const [movies, shows, games, albums] = await Promise.all([
    getUpcomingMovies(),
    getUpcomingShows(),
    getUpcomingGames(),
    getUpcomingAlbums(),
  ]);

  return {
    MOVIE: movies.map((movie) => ({
      source: "tmdb", sourceId: String(movie.id), type: "MOVIE", title: movie.title,
      displayDate: formatDate(movie.release_date), releaseDate: movie.release_date,
      sortTimestamp: movie.release_date ? `${movie.release_date}T12:00:00.000Z` : null,
      isApproximate: false, posterUrl: tmdbImage(movie.poster_path, "w500"),
      backdropUrl: tmdbImage(movie.backdrop_path, "w780"), description: movie.overview,
      externalUrl: `https://www.themoviedb.org/movie/${movie.id}`, tmdbId: movie.id,
      genreIds: movie.genre_ids ?? [], popularity: movie.popularity ?? 0, href: `/movies/${movie.id}`,
    })),
    SHOW: shows.map((show) => ({
      source: "tmdb", sourceId: String(show.id), type: "SHOW", title: show.name,
      displayDate: formatDate(show.first_air_date), releaseDate: show.first_air_date,
      sortTimestamp: show.first_air_date ? `${show.first_air_date}T12:00:00.000Z` : null,
      isApproximate: false, posterUrl: tmdbImage(show.poster_path, "w500"),
      backdropUrl: tmdbImage(show.backdrop_path, "w780"), description: show.overview,
      externalUrl: `https://www.themoviedb.org/tv/${show.id}`, tmdbId: show.id,
      genreIds: show.genre_ids ?? [], popularity: show.popularity ?? 0, href: `/shows/${show.id}`,
    })),
    GAME: games,
    MUSIC: albums,
  };
}

type SteamSearchResponse = { results_html?: string; total_count?: number };

function decodeHtml(value: string) {
  return value.replaceAll("&amp;", "&").replaceAll("&quot;", '"').replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<").replaceAll("&gt;", ">").replace(/&#(\d+);/g, (_match, code: string) => String.fromCodePoint(Number(code)));
}

function parseApproximateDate(raw: string): { iso: string | null; label: string; approximate: boolean } {
  const label = raw.trim() || "Coming soon";
  const quarter = label.match(/q([1-4])\s+(20\d{2})/i);
  if (quarter) {
    const month = (Number(quarter[1]) - 1) * 3 + 1;
    return { iso: `${quarter[2]}-${String(month).padStart(2, "0")}-01`, label, approximate: true };
  }
  const date = Date.parse(label);
  if (!Number.isFinite(date)) return { iso: null, label, approximate: true };
  const parsed = new Date(date);
  const iso = `${parsed.getUTCFullYear()}-${String(parsed.getUTCMonth() + 1).padStart(2, "0")}-${String(parsed.getUTCDate()).padStart(2, "0")}`;
  return { iso, label, approximate: !/\b\d{1,2},?\s+20\d{2}\b/.test(label) };
}

async function getUpcomingGames(): Promise<RadarItem[]> {
  try {
    const url = new URL("https://store.steampowered.com/search/results/");
    url.search = new URLSearchParams({ query: "", start: "0", count: "50", dynamic_data: "", sort_by: "_ASC", filter: "comingsoon", infinite: "1" }).toString();
    const response = await fetch(url, {
      headers: { accept: "application/json", "user-agent": "HorizonReleaseRadar/1.0" },
      next: { revalidate: 3600 }, signal: AbortSignal.timeout(9_000),
    });
    if (!response.ok) return [];
    const payload = await response.json() as SteamSearchResponse;
    const html = payload.results_html ?? "";
    const cards = html.match(/<a\b(?=[^>]*\bsearch_result_row\b)[^>]*>[\s\S]*?<\/a>/gi) ?? [];
    const today = new Date().toISOString().slice(0, 10);
    return cards.flatMap((card): RadarItem[] => {
      const href = card.match(/\bhref=["']([^"']+)/i)?.[1];
      const id = card.match(/\bdata-ds-appid=["'](\d+)/i)?.[1];
      const title = card.match(/class=["'][^"']*title[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)?.[1];
      if (!href || !id || !title) return [];
      const releaseText = card.match(/class=["'][^"']*search_released[^"']*["'][^>]*>([\s\S]*?)<\//i)?.[1];
      const poster = card.match(/<img[^>]+(?:src|data-src)=["']([^"']+)/i)?.[1];
      const release = parseApproximateDate(decodeHtml((releaseText ?? "Coming soon").replace(/<[^>]+>/g, " ")).trim());
      if (release.iso && release.iso < today) return [];
      return [{
        source: "steam", sourceId: id, type: "GAME", title: decodeHtml(title.replace(/<[^>]+>/g, "")).trim(),
        displayDate: release.label, releaseDate: release.iso,
        sortTimestamp: release.iso ? `${release.iso}T12:00:00.000Z` : null,
        isApproximate: release.approximate, posterUrl: poster ? decodeHtml(poster) : null,
        backdropUrl: null, description: "Upcoming PC game listed on Steam.",
        externalUrl: decodeHtml(href), tmdbId: null, genreIds: [], popularity: 0,
        href: decodeHtml(href),
      }];
    });
  } catch {
    return [];
  }
}

type MusicBrainzReleaseGroup = {
  id: string;
  title: string;
  "first-release-date"?: string;
  "artist-credit"?: Array<{ name?: string; artist?: { name?: string } }>;
  score?: number;
};

async function getUpcomingAlbums(): Promise<RadarItem[]> {
  const start = new Date();
  const end = new Date(start);
  end.setUTCFullYear(end.getUTCFullYear() + 2);
  const today = start.toISOString().slice(0, 10);
  const limit = end.toISOString().slice(0, 10);
  const query = `firstreleasedate:[${today} TO ${limit}] AND primarytype:album`;
  const url = new URL("https://musicbrainz.org/ws/2/release-group/");
  url.searchParams.set("query", query);
  url.searchParams.set("fmt", "json");
  url.searchParams.set("limit", "100");

  try {
    const response = await fetch(url, {
      headers: { accept: "application/json", "user-agent": "HorizonReleaseRadar/1.0 (personal release calendar)" },
      next: { revalidate: 86_400 }, signal: AbortSignal.timeout(9_000),
    });
    if (!response.ok) return [];
    const payload = await response.json() as { "release-groups"?: MusicBrainzReleaseGroup[] };
    return (payload["release-groups"] ?? []).flatMap((group): RadarItem[] => {
      const date = group["first-release-date"] ?? "";
      if (!date || date < today || date > limit) return [];
      const dateValue = new Date(`${date.length === 4 ? `${date}-01-01` : date.length === 7 ? `${date}-01` : date}T12:00:00Z`);
      const artist = group["artist-credit"]?.map((credit) => credit.name ?? credit.artist?.name).filter(Boolean).join(", ");
      const dayExact = /^\d{4}-\d{2}-\d{2}$/.test(date);
      return [{
        source: "musicbrainz", sourceId: group.id, type: "MUSIC", title: group.title,
        displayDate: `${formatDate(date)}${artist ? ` · ${artist}` : ""}`,
        releaseDate: dayExact ? date : null,
        sortTimestamp: Number.isFinite(dateValue.getTime()) ? dateValue.toISOString() : null,
        isApproximate: !dayExact,
        posterUrl: `https://coverartarchive.org/release-group/${group.id}/front-500`,
        backdropUrl: null,
        description: artist ? `Upcoming album by ${artist}.` : "Upcoming album release.",
        externalUrl: `https://musicbrainz.org/release-group/${group.id}`, tmdbId: null,
        genreIds: [], popularity: Number(group.score ?? 0),
        href: `https://musicbrainz.org/release-group/${group.id}`,
      }];
    }).sort((a, b) => (a.sortTimestamp ?? "").localeCompare(b.sortTimestamp ?? ""));
  } catch {
    return [];
  }
}
