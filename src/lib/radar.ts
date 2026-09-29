import "server-only";
import { getExploreMovies, getExploreShows, getUpcomingMovies, getUpcomingShows, tmdbImage } from "@/lib/tmdb";

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
  posterFallbackUrls?: string[];
  backdropUrl: string | null;
  description: string;
  externalUrl: string | null;
  tmdbId: number | null;
  genreIds: number[];
  popularity: number;
  voteAverage?: number;
  voteCount?: number;
  href: string;
};

export type ExploreType = RadarType;

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
      voteAverage: movie.vote_average ?? 0, voteCount: movie.vote_count ?? 0,
    })),
    SHOW: shows.map((show) => ({
      source: "tmdb", sourceId: String(show.id), type: "SHOW", title: show.name,
      displayDate: formatDate(show.first_air_date), releaseDate: show.first_air_date,
      sortTimestamp: show.first_air_date ? `${show.first_air_date}T12:00:00.000Z` : null,
      isApproximate: false, posterUrl: tmdbImage(show.poster_path, "w500"),
      backdropUrl: tmdbImage(show.backdrop_path, "w780"), description: show.overview,
      externalUrl: `https://www.themoviedb.org/tv/${show.id}`, tmdbId: show.id,
      genreIds: show.genre_ids ?? [], popularity: show.popularity ?? 0, href: `/shows/${show.id}`,
      voteAverage: show.vote_average ?? 0, voteCount: show.vote_count ?? 0,
    })),
    GAME: games,
    MUSIC: albums,
  };
}

export async function getExploreRadar(type: ExploreType, options: { genreId?: number; year?: number; sort?: "popular" | "rated"; page?: number } = {}): Promise<RadarItem[]> {
  if (type === "MOVIE") {
    const movies = await getExploreMovies(options);
    return movies.map((movie) => ({
      source: "tmdb", sourceId: String(movie.id), type, title: movie.title,
      displayDate: formatDate(movie.release_date), releaseDate: movie.release_date || null,
      sortTimestamp: movie.release_date ? `${movie.release_date}T12:00:00.000Z` : null,
      isApproximate: false, posterUrl: tmdbImage(movie.poster_path, "w500"),
      backdropUrl: tmdbImage(movie.backdrop_path, "w780"), description: movie.overview,
      externalUrl: `https://www.themoviedb.org/movie/${movie.id}`, tmdbId: movie.id,
      genreIds: movie.genre_ids ?? [], popularity: movie.popularity ?? 0,
      voteAverage: movie.vote_average ?? 0, voteCount: movie.vote_count ?? 0,
      href: `/movies/${movie.id}`,
    }));
  }
  if (type === "SHOW") {
    const shows = await getExploreShows(options);
    return shows.map((show) => ({
    source: "tmdb", sourceId: String(show.id), type, title: show.name,
    displayDate: formatDate(show.first_air_date), releaseDate: show.first_air_date || null,
    sortTimestamp: show.first_air_date ? `${show.first_air_date}T12:00:00.000Z` : null,
    isApproximate: false, posterUrl: tmdbImage(show.poster_path, "w500"),
    backdropUrl: tmdbImage(show.backdrop_path, "w780"), description: show.overview,
    externalUrl: `https://www.themoviedb.org/tv/${show.id}`, tmdbId: show.id,
    genreIds: show.genre_ids ?? [], popularity: show.popularity ?? 0,
    voteAverage: show.vote_average ?? 0, voteCount: show.vote_count ?? 0,
    href: `/shows/${show.id}`,
    }));
  }
  if (type === "GAME") return getExploreGames(options.year, options.sort ?? "popular", options.page ?? 1);
  return getExploreAlbums(options.year ?? new Date().getFullYear(), options.sort ?? "popular", options.page ?? 1);
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

function parseSteamCards(html: string, options: { upcomingOnly?: boolean; offset?: number } = {}) {
  const cards = html.match(/<a\b(?=[^>]*\bsearch_result_row\b)[^>]*>[\s\S]*?<\/a>/gi) ?? [];
  const today = new Date().toISOString().slice(0, 10);
  return cards.flatMap((card, index): RadarItem[] => {
    const href = card.match(/\bhref=["']([^"']+)/i)?.[1];
    const id = card.match(/\bdata-ds-appid=["'](\d+)/i)?.[1];
    const title = card.match(/class=["'][^"']*title[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)?.[1];
    if (!href || !id || !title) return [];
    const releaseText = card.match(/class=["'][^"']*search_released[^"']*["'][^>]*>([\s\S]*?)<\//i)?.[1];
    const poster = card.match(/<img[^>]+(?:src|data-src)=["']([^"']+)/i)?.[1];
    const release = parseApproximateDate(decodeHtml((releaseText ?? "Coming soon").replace(/<[^>]+>/g, " ")).trim());
    const cleanTitle = decodeHtml(title.replace(/<[^>]+>/g, "")).trim();
    if (options.upcomingOnly && release.iso && release.iso < today) return [];
    if (/\b(demo|prologue|playtest|soundtrack|original game soundtrack|server test)\b/i.test(cleanTitle)) return [];
    const libraryArt = `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${id}/library_600x900.jpg`;
    const cdnArt = `https://cdn.cloudflare.steamstatic.com/steam/apps/${id}/library_600x900.jpg`;
    const headerArt = `https://cdn.cloudflare.steamstatic.com/steam/apps/${id}/header.jpg`;
    const scoreText = decodeHtml(card.match(/data-tooltip-html=["']([^"']+)["']/i)?.[1] ?? "").toLowerCase();
    const voteAverage = /overwhelmingly positive/.test(scoreText) ? 9.6
      : /very positive/.test(scoreText) ? 8.7
      : /mostly positive/.test(scoreText) ? 7.8
      : /positive/.test(scoreText) ? 7.2
      : /mixed/.test(scoreText) ? 6
      : /mostly negative/.test(scoreText) ? 4.5
      : /negative/.test(scoreText) ? 3.5 : undefined;
    const displayDate = release.label;
    return [{
      source: "steam", sourceId: id, type: "GAME", title: cleanTitle,
      displayDate, releaseDate: release.iso,
      sortTimestamp: release.iso ? `${release.iso}T12:00:00.000Z` : null,
      isApproximate: release.approximate, posterUrl: libraryArt,
      posterFallbackUrls: [cdnArt, headerArt, ...(poster ? [decodeHtml(poster)] : [])],
      backdropUrl: null, description: "Steam game listing.",
      externalUrl: decodeHtml(href), tmdbId: null, genreIds: [],
      popularity: 1 / ((options.offset ?? 0) + index + 1),
      ...(voteAverage ? { voteAverage } : {}),
      href: `/releases/steam/${id}`,
    }];
  });
}

async function getUpcomingGames(): Promise<RadarItem[]> {
  try {
    const url = new URL("https://store.steampowered.com/search/results/");
    url.search = new URLSearchParams({ query: "", start: "0", count: "50", dynamic_data: "", sort_by: "_ASC", filter: "popularcomingsoon", infinite: "1", cc: "us", l: "english" }).toString();
    const response = await fetch(url, {
      headers: { accept: "application/json", "user-agent": "HorizonReleaseRadar/1.0" },
      next: { revalidate: 3600 }, signal: AbortSignal.timeout(9_000),
    });
    if (!response.ok) return [];
    const payload = await response.json() as SteamSearchResponse;
    return parseSteamCards(payload.results_html ?? "", { upcomingOnly: true });
  } catch {
    return [];
  }
}

async function getExploreGames(year: number | undefined, sort: "popular" | "rated", page: number): Promise<RadarItem[]> {
  try {
    const offsets = year ? [0, 50, 100, 150] : [(Math.max(1, page) - 1) * 50];
    const results = await Promise.all(offsets.map(async (offset) => {
      const url = new URL("https://store.steampowered.com/search/results/");
      url.search = new URLSearchParams({ query: "", start: String(offset), count: "50", dynamic_data: "", sort_by: sort === "rated" ? "Reviews_DESC" : "Reviews_DESC", cc: "us", l: "english" }).toString();
      const response = await fetch(url, {
        headers: { accept: "application/json", "user-agent": "HorizonReleaseRadar/1.0" },
        next: { revalidate: 86_400 }, signal: AbortSignal.timeout(9_000),
      });
      if (!response.ok) return [];
      const payload = await response.json() as SteamSearchResponse;
      return parseSteamCards(payload.results_html ?? "", { offset });
    }));
    const unique = new Map<string, RadarItem>();
    for (const item of results.flat()) {
      if (year && item.releaseDate?.slice(0, 4) !== String(year)) continue;
      if (!unique.has(item.sourceId)) unique.set(item.sourceId, item);
    }
    return [...unique.values()].sort((a, b) => sort === "rated"
      ? (b.voteAverage ?? 0) - (a.voteAverage ?? 0) || b.popularity - a.popularity
      : b.popularity - a.popularity);
  } catch {
    return [];
  }
}

type MusicBrainzRelease = {
  id: string;
  date?: string;
  country?: string;
  title: string;
  "artist-credit"?: Array<{ name?: string; artist?: { id?: string; name?: string } }>;
  score?: number;
  "release-group"?: {
    id: string;
    title: string;
    "primary-type"?: string;
    "secondary-types"?: string[];
    "first-release-date"?: string;
  };
};

function mapAlbumRelease(release: MusicBrainzRelease, group: NonNullable<MusicBrainzRelease["release-group"]>, date: string): RadarItem {
  const artist = release["artist-credit"]?.map((credit) => credit.name ?? credit.artist?.name).filter(Boolean).join(", ");
  const exactDay = /^\d{4}-\d{2}-\d{2}$/.test(date);
  const dateForParsing = `${date}${date.length === 4 ? "-01-01" : date.length === 7 ? "-01" : ""}`;
  const dateValue = new Date(`${dateForParsing}T12:00:00Z`);
  const dateLabel = date.length === 4 ? date : date.length === 7
    ? new Date(`${date}-01T12:00:00Z`).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" })
    : formatDate(date);
  return {
    source: "musicbrainz", sourceId: group.id, type: "MUSIC", title: group.title,
    displayDate: `${dateLabel}${artist ? ` · ${artist}` : ""}`,
    releaseDate: exactDay ? date : null,
    sortTimestamp: Number.isFinite(dateValue.getTime()) ? dateValue.toISOString() : null,
    isApproximate: !exactDay,
    posterUrl: `https://coverartarchive.org/release-group/${group.id}/front-500`,
    backdropUrl: null,
    description: artist ? `Album by ${artist}.` : "Music release.",
    externalUrl: `https://musicbrainz.org/release-group/${group.id}`, tmdbId: null,
    genreIds: [], popularity: Number(release.score ?? 0),
    href: `/releases/musicbrainz/${group.id}`,
  };
}

function isSoundtrackOrCompilation(group: NonNullable<MusicBrainzRelease["release-group"]>, title: string, artist: string) {
  const secondary = group["secondary-types"] ?? [];
  return secondary.some((value) => /soundtrack|compilation|dj-mix|live|spokenword|audiobook/i.test(value))
    || /soundtrack|motion picture|video game|original score|music from|music inspired by/i.test(title)
    || /original soundtrack|motion picture soundtrack|video game music/i.test(artist);
}

async function listenBrainzPopularity(kind: "artist" | "release-group", ids: string[]) {
  const uniqueIds = [...new Set(ids.filter((id) => /^[0-9a-f-]{36}$/i.test(id)))].slice(0, 100);
  if (!uniqueIds.length) return new Map<string, number>();
  try {
    const response = await fetch(`https://api.listenbrainz.org/1/popularity/${kind}`, {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify({ [`${kind.replace("-", "_")}_mbids`]: uniqueIds }),
      next: { revalidate: 86_400 }, signal: AbortSignal.timeout(9_000),
    });
    if (!response.ok) return new Map();
    const payload = await response.json() as Record<string, unknown>[];
    const idField = `${kind.replace("-", "_")}_mbid`;
    return new Map(payload.flatMap((entry) => {
      const id = typeof entry[idField] === "string" ? entry[idField] as string : "";
      const listeners = Number(entry.total_user_count ?? 0);
      const listens = Number(entry.total_listen_count ?? 0);
      return id ? [[id, listeners || listens]] : [];
    }));
  } catch {
    return new Map();
  }
}

async function getUpcomingAlbums(): Promise<RadarItem[]> {
  const start = new Date();
  const end = new Date(start);
  end.setUTCFullYear(end.getUTCFullYear() + 2);
  const today = start.toISOString().slice(0, 10);
  const limit = end.toISOString().slice(0, 10);
  const query = `country:US AND date:[${today} TO ${limit}] AND status:official`;
  const url = new URL("https://musicbrainz.org/ws/2/release/");
  url.searchParams.set("query", query);
  url.searchParams.set("fmt", "json");
  url.searchParams.set("limit", "100");
  url.searchParams.set("inc", "release-groups");

  try {
    const response = await fetch(url, {
      headers: { accept: "application/json", "user-agent": "HorizonReleaseRadar/1.0 (personal release calendar)" },
      next: { revalidate: 86_400 }, signal: AbortSignal.timeout(9_000),
    });
    if (!response.ok) return [];
    const payload = await response.json() as { releases?: MusicBrainzRelease[] };
    const grouped = new Map<string, { release: MusicBrainzRelease; date: string; group: NonNullable<MusicBrainzRelease["release-group"]> }>();
    for (const release of payload.releases ?? []) {
      const group = release["release-group"];
      const date = release.date ?? group?.["first-release-date"] ?? "";
      if (release.country && release.country !== "US") continue;
      if (!group?.id || !["album", "single", "ep"].includes((group["primary-type"] ?? "").toLowerCase())) continue;
      const creditedArtist = release["artist-credit"]?.map((credit) => credit.name ?? credit.artist?.name).filter(Boolean).join(", ") ?? "";
      if (isSoundtrackOrCompilation(group, group.title, creditedArtist)) continue;
      if (!date || date < today.slice(0, date.length) || date > limit.slice(0, date.length)) continue;
      const existing = grouped.get(group.id);
      if (!existing || date.length > existing.date.length) grouped.set(group.id, { release, date, group });
    }
    const rows = [...grouped.values()];
    const artistIds = rows.flatMap(({ release }) => release["artist-credit"]?.flatMap((credit) => credit.artist?.id ? [credit.artist.id] : []) ?? []);
    const popularity = await listenBrainzPopularity("artist", artistIds);
    const scored = rows.map(({ release, date, group }) => {
      const artistId = release["artist-credit"]?.find((credit) => credit.artist?.id)?.artist?.id;
      const item = mapAlbumRelease(release, group, date);
      return { item: { ...item, popularity: artistId ? popularity.get(artistId) ?? 0 : 0 }, fallbackScore: Number(release.score ?? 0) };
    });
    const withAudience = scored.filter(({ item }) => item.popularity > 0);
    return (withAudience.length ? withAudience.map(({ item }) => item) : scored.map(({ item, fallbackScore }) => ({ ...item, popularity: fallbackScore })))
      .sort((a, b) => (a.sortTimestamp ?? "").localeCompare(b.sortTimestamp ?? ""));
  } catch {
    return [];
  }
}

async function getExploreAlbums(year: number, sort: "popular" | "rated", page: number): Promise<RadarItem[]> {
  const from = `${year}-01-01`;
  const to = `${year}-12-31`;
  const query = `country:US AND date:[${from} TO ${to}] AND status:official AND primarytype:album`;
  const url = new URL("https://musicbrainz.org/ws/2/release/");
  url.searchParams.set("query", query);
  url.searchParams.set("fmt", "json");
  url.searchParams.set("limit", "100");
  url.searchParams.set("offset", String((Math.max(1, page) - 1) * 100));
  url.searchParams.set("inc", "release-groups");
  try {
    const response = await fetch(url, {
      headers: { accept: "application/json", "user-agent": "HorizonReleaseRadar/1.0 (personal release calendar)" },
      next: { revalidate: 86_400 }, signal: AbortSignal.timeout(9_000),
    });
    if (!response.ok) return [];
    const payload = await response.json() as { releases?: MusicBrainzRelease[] };
    const grouped = new Map<string, { item: RadarItem; score: number }>();
    for (const release of payload.releases ?? []) {
      const group = release["release-group"];
      const date = release.date ?? group?.["first-release-date"] ?? "";
      if (release.country && release.country !== "US") continue;
      if (!group?.id || group["primary-type"]?.toLowerCase() !== "album") continue;
      if (date.slice(0, 4) !== String(year)) continue;
      const artist = release["artist-credit"]?.map((credit) => credit.name ?? credit.artist?.name).filter(Boolean).join(", ") ?? "";
      if (isSoundtrackOrCompilation(group, group.title, artist)) continue;
      const item = mapAlbumRelease(release, group, date);
      const score = Number(release.score ?? 0);
      const current = grouped.get(group.id);
      if (!current || score > current.score) grouped.set(group.id, { item, score });
    }
    const candidates = [...grouped.values()].map(({ item }) => item);
    const popularity = await listenBrainzPopularity("release-group", candidates.map((item) => item.sourceId));
    const scored = candidates.map((item) => ({ ...item, popularity: popularity.get(item.sourceId) ?? 0 }));
    const withAudience = scored.filter((item) => item.popularity > 0);
    const ranked = withAudience.length ? withAudience : candidates;
    return ranked.sort((a, b) => sort === "rated"
      ? b.popularity - a.popularity || a.title.localeCompare(b.title)
      : b.popularity - a.popularity || a.title.localeCompare(b.title));
  } catch {
    return [];
  }
}

export type SteamGameDetails = {
  appId: string;
  name: string;
  shortDescription: string;
  detailedDescription: string;
  releaseDate: string;
  comingSoon: boolean;
  headerImage: string | null;
  background: string | null;
  developers: string[];
  publishers: string[];
  genres: string[];
  screenshots: string[];
  trailers: { name: string; poster: string; webm: string | null; mp4: string | null }[];
  recommendations: number | null;
};

type SteamAppData = {
  name?: string;
  short_description?: string;
  detailed_description?: string;
  release_date?: { coming_soon?: boolean; date?: string };
  header_image?: string;
  background?: string;
  developers?: string[];
  publishers?: string[];
  genres?: { description?: string }[];
  screenshots?: { path_full?: string }[];
  movies?: { name?: string; thumbnail?: string; webm?: { max?: string }; mp4?: { max?: string } }[];
  recommendations?: { total?: number };
};

export async function getSteamGameDetails(appId: string): Promise<SteamGameDetails | null> {
  if (!/^\d{1,12}$/.test(appId)) return null;
  try {
    const response = await fetch(`https://store.steampowered.com/api/appdetails?appids=${appId}&cc=us&l=en`, {
      headers: { accept: "application/json", "user-agent": "HorizonReleaseRadar/1.0" },
      next: { revalidate: 3600 }, signal: AbortSignal.timeout(9_000),
    });
    if (!response.ok) return null;
    const result = await response.json() as Record<string, { success?: boolean; data?: SteamAppData }>;
    const data = result[appId]?.success ? result[appId].data : null;
    if (!data?.name) return null;
    return {
      appId,
      name: data.name,
      shortDescription: data.short_description ?? "",
      detailedDescription: data.detailed_description ?? "",
      releaseDate: data.release_date?.date ?? "Coming soon",
      comingSoon: Boolean(data.release_date?.coming_soon),
      headerImage: data.header_image ?? null,
      background: data.background ?? null,
      developers: data.developers ?? [],
      publishers: data.publishers ?? [],
      genres: data.genres?.map((genre) => genre.description ?? "").filter(Boolean) ?? [],
      screenshots: data.screenshots?.map((screenshot) => screenshot.path_full ?? "").filter(Boolean).slice(0, 12) ?? [],
      trailers: data.movies?.map((movie) => ({ name: movie.name ?? "Trailer", poster: movie.thumbnail ?? "", webm: movie.webm?.max ?? null, mp4: movie.mp4?.max ?? null })).filter((movie) => movie.webm || movie.mp4).slice(0, 8) ?? [],
      recommendations: data.recommendations?.total ?? null,
    };
  } catch {
    return null;
  }
}

export type MusicReleaseDetails = {
  id: string;
  title: string;
  artist: string;
  releaseDate: string;
  tags: string[];
  coverUrl: string;
  tracks: { title: string; artist: string; previewUrl: string | null; artworkUrl: string | null }[];
};

type MusicBrainzGroupDetails = {
  id: string;
  title?: string;
  "first-release-date"?: string;
  "artist-credit"?: { name?: string; artist?: { name?: string } }[];
  tags?: { name?: string; count?: number }[];
};

export async function getMusicReleaseDetails(groupId: string): Promise<MusicReleaseDetails | null> {
  if (!/^[0-9a-f-]{36}$/i.test(groupId)) return null;
  try {
    const response = await fetch(`https://musicbrainz.org/ws/2/release-group/${groupId}?inc=artists+tags&fmt=json`, {
      headers: { accept: "application/json", "user-agent": "HorizonReleaseRadar/1.0 (personal release calendar)" },
      next: { revalidate: 86_400 }, signal: AbortSignal.timeout(9_000),
    });
    if (!response.ok) return null;
    const group = await response.json() as MusicBrainzGroupDetails;
    const artist = group["artist-credit"]?.map((credit) => credit.name ?? credit.artist?.name).filter(Boolean).join(", ") ?? "Unknown artist";
    const title = group.title ?? "Music release";
    const term = new URLSearchParams({ term: `${artist} ${title}`, entity: "song", limit: "10", country: "US" });
    const lookup = await fetch(`https://itunes.apple.com/search?${term}`, { next: { revalidate: 86_400 }, signal: AbortSignal.timeout(8_000) });
    const lookupPayload = lookup.ok ? await lookup.json() as { results?: { trackName?: string; artistName?: string; previewUrl?: string; artworkUrl100?: string }[] } : {};
    return {
      id: groupId,
      title,
      artist,
      releaseDate: group["first-release-date"] ?? "Release date unavailable",
      tags: (group.tags ?? []).slice().sort((a, b) => (b.count ?? 0) - (a.count ?? 0)).slice(0, 8).map((tag) => tag.name ?? "").filter(Boolean),
      coverUrl: `https://coverartarchive.org/release-group/${groupId}/front-500`,
      tracks: (lookupPayload.results ?? []).slice(0, 8).map((track) => ({ title: track.trackName ?? title, artist: track.artistName ?? artist, previewUrl: track.previewUrl ?? null, artworkUrl: track.artworkUrl100 ?? null })),
    };
  } catch {
    return null;
  }
}
