import "server-only";
import { getExploreMovies, getExploreShows, getUpcomingMovies, getUpcomingShows, tmdbImage } from "@/lib/tmdb";
import { discoverShelves, type DiscoverShelf } from "@/lib/discover-shelves";
import { isExplicitlyAiGenerated } from "@/lib/media-quality";

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
  tags?: string[];
  previewUrl?: string | null;
  artistName?: string;
  voteAverage?: number;
  voteCount?: number;
  ratingScale?: 5 | 10;
  ratingLabel?: string;
  ratingSource?: string;
  href: string;
};

export type ExploreType = RadarType;

export type RadarShelf = DiscoverShelf & { items: RadarItem[] };

let musicBrainzQueue = Promise.resolve();
let lastMusicBrainzRequest = 0;

function musicBrainzFetch(url: URL | string, init: NonNullable<Parameters<typeof fetch>[1]>) {
  const request = musicBrainzQueue.then(async () => {
    const delay = Math.max(0, 1_100 - (Date.now() - lastMusicBrainzRequest));
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
    lastMusicBrainzRequest = Date.now();
    return fetch(url, init);
  });
  musicBrainzQueue = request.then(() => undefined, () => undefined);
  return request;
}

function formatDate(value: string) {
  if (!value) return "Date TBA";
  if (/^\d{4}$/.test(value)) return `${value} · Date TBA`;
  const normalized = /^\d{4}-\d{2}$/.test(value) ? `${value}-01` : value;
  const date = new Date(`${normalized}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  const label = date.toLocaleDateString("en-US", {
    ...(value.length === 7 ? { month: "short" } : { month: "short", day: "numeric" }), year: "numeric", timeZone: "UTC",
  });
  return value.length === 7 ? `${label} · Day TBA` : label;
}

function dateParts(value: string) {
  const canonical = /^\d{4}$/.test(value) ? `${value}-01-01` : /^\d{4}-\d{2}$/.test(value) ? `${value}-01` : value;
  const date = new Date(`${canonical}T12:00:00.000Z`);
  const valid = /^\d{4}(?:-\d{2})?(?:-\d{2})?$/.test(value) && Number.isFinite(date.getTime());
  const exact = /^\d{4}-\d{2}-\d{2}$/.test(value);
  return { exact, timestamp: valid ? date.toISOString() : null };
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
      displayDate: formatDate(movie.release_date), releaseDate: dateParts(movie.release_date).exact ? movie.release_date : null,
      sortTimestamp: dateParts(movie.release_date).timestamp,
      isApproximate: !dateParts(movie.release_date).exact, posterUrl: tmdbImage(movie.poster_path, "w500"),
      posterFallbackUrls: [tmdbImage(movie.backdrop_path, "w780")].filter((image): image is string => Boolean(image)),
      backdropUrl: tmdbImage(movie.backdrop_path, "w780"), description: movie.overview,
      externalUrl: `https://www.themoviedb.org/movie/${movie.id}`, tmdbId: movie.id,
      genreIds: movie.genre_ids ?? [], popularity: movie.popularity ?? 0, href: `/movies/${movie.id}`,
      voteAverage: movie.vote_average ?? 0, voteCount: movie.vote_count ?? 0, ratingScale: 10, ratingSource: "TMDB",
    })),
    SHOW: shows.map((show) => ({
      source: "tmdb", sourceId: String(show.id), type: "SHOW", title: show.name,
      displayDate: formatDate(show.first_air_date), releaseDate: dateParts(show.first_air_date).exact ? show.first_air_date : null,
      sortTimestamp: dateParts(show.first_air_date).timestamp,
      isApproximate: !dateParts(show.first_air_date).exact, posterUrl: tmdbImage(show.poster_path, "w500"),
      posterFallbackUrls: [tmdbImage(show.backdrop_path, "w780")].filter((image): image is string => Boolean(image)),
      backdropUrl: tmdbImage(show.backdrop_path, "w780"), description: show.overview,
      externalUrl: `https://www.themoviedb.org/tv/${show.id}`, tmdbId: show.id,
      genreIds: show.genre_ids ?? [], popularity: show.popularity ?? 0, href: `/shows/${show.id}`,
      voteAverage: show.vote_average ?? 0, voteCount: show.vote_count ?? 0, ratingScale: 10, ratingSource: "TMDB",
    })),
    GAME: games,
    MUSIC: albums,
  };
}

export async function getExploreRadar(type: ExploreType, options: { genreId?: number; genre?: string; year?: number; sort?: "popular" | "rated"; page?: number; query?: string } = {}): Promise<RadarItem[]> {
  if (type === "MOVIE") {
    const genreId = options.genreId ?? (options.genre && /^\d+$/.test(options.genre) ? Number(options.genre) : undefined);
    const movies = await getExploreMovies({ ...options, genreId });
    return movies.map((movie) => ({
      source: "tmdb", sourceId: String(movie.id), type, title: movie.title,
      displayDate: formatDate(movie.release_date), releaseDate: movie.release_date || null,
      sortTimestamp: movie.release_date ? `${movie.release_date}T12:00:00.000Z` : null,
      isApproximate: false, posterUrl: tmdbImage(movie.poster_path, "w500"),
      posterFallbackUrls: [tmdbImage(movie.backdrop_path, "w780")].filter((image): image is string => Boolean(image)),
      backdropUrl: tmdbImage(movie.backdrop_path, "w780"), description: movie.overview,
      externalUrl: `https://www.themoviedb.org/movie/${movie.id}`, tmdbId: movie.id,
      genreIds: movie.genre_ids ?? [], popularity: movie.popularity ?? 0,
      voteAverage: movie.vote_average ?? 0, voteCount: movie.vote_count ?? 0, ratingScale: 10, ratingSource: "TMDB",
      href: `/movies/${movie.id}`,
    }));
  }
  if (type === "SHOW") {
    const genreId = options.genreId ?? (options.genre && /^\d+$/.test(options.genre) ? Number(options.genre) : undefined);
    const shows = await getExploreShows({ ...options, genreId });
    return shows.map((show) => ({
    source: "tmdb", sourceId: String(show.id), type, title: show.name,
    displayDate: formatDate(show.first_air_date), releaseDate: show.first_air_date || null,
    sortTimestamp: show.first_air_date ? `${show.first_air_date}T12:00:00.000Z` : null,
    isApproximate: false, posterUrl: tmdbImage(show.poster_path, "w500"),
    posterFallbackUrls: [tmdbImage(show.backdrop_path, "w780")].filter((image): image is string => Boolean(image)),
    backdropUrl: tmdbImage(show.backdrop_path, "w780"), description: show.overview,
    externalUrl: `https://www.themoviedb.org/tv/${show.id}`, tmdbId: show.id,
    genreIds: show.genre_ids ?? [], popularity: show.popularity ?? 0,
    voteAverage: show.vote_average ?? 0, voteCount: show.vote_count ?? 0, ratingScale: 10, ratingSource: "TMDB",
    href: `/shows/${show.id}`,
    }));
  }
  if (type === "GAME") {
    return getExploreGames(options.year, options.sort ?? "popular", options.page ?? 1, options.genre, options.query);
  }
  return getExploreAlbums(options.year, options.sort ?? "popular", options.page ?? 1, options.genre);
}

type MusicBrainzArtist = { id: string; name: string; score?: number; type?: string; disambiguation?: string };
type MusicBrainzReleaseGroup = NonNullable<MusicBrainzRelease["release-group"]> & {
  id: string;
  title: string;
  "first-release-date"?: string;
  "primary-type"?: string;
  "secondary-types"?: string[];
};
type MusicBrainzRecording = {
  id: string;
  title: string;
  "first-release-date"?: string;
  disambiguation?: string;
  length?: number;
};

function normalizedMusicText(value: string) {
  return value.toLocaleLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

function musicSearchItem({ id, title, date, artist, label, image, description, source = "musicbrainz", previewUrl }: {
  id: string;
  title: string;
  date: string;
  artist: string;
  label: string;
  image?: string;
  description: string;
  source?: string;
  previewUrl?: string | null;
}): RadarItem {
  const dateForParsing = date ? `${date}${date.length === 4 ? "-01-01" : date.length === 7 ? "-01" : ""}` : "";
  const parsed = dateForParsing ? new Date(`${dateForParsing}T12:00:00Z`) : null;
  const yearLabel = date || "Release date not listed";
  const detailDate = /^\d{4}-\d{2}-\d{2}$/.test(date) && parsed && Number.isFinite(parsed.getTime())
    ? parsed.toISOString().slice(0, 10)
    : null;
  const path = source === "musicbrainz-recording" ? `/releases/musicbrainz-recording/${id}` : `/releases/musicbrainz/${id}`;
  return {
    source, sourceId: id, type: "MUSIC", title,
    displayDate: `${label} · ${yearLabel}`,
    releaseDate: detailDate,
    sortTimestamp: parsed && Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null,
    isApproximate: !/^\d{4}-\d{2}-\d{2}$/.test(date),
    posterUrl: image ?? null, backdropUrl: null, description, artistName: artist, previewUrl,
    externalUrl: source === "musicbrainz-recording" ? `https://musicbrainz.org/recording/${id}` : `https://musicbrainz.org/release-group/${id}`,
    tmdbId: null, genreIds: [], popularity: 0, href: path,
  };
}

function musicBrainzOptions() {
  return {
    headers: { accept: "application/json", "user-agent": "HorizonReleaseRadar/1.0 (personal release calendar)" },
    next: { revalidate: 86_400 }, signal: AbortSignal.timeout(15_000),
  };
}

async function musicArtistPortrait(name: string) {
  try {
    const search = new URL("https://itunes.apple.com/search");
    search.search = new URLSearchParams({ term: name, entity: "musicArtist", limit: "10", country: "US" }).toString();
    const searchResponse = await fetch(search, { headers: { accept: "application/json" }, next: { revalidate: 604_800 }, signal: AbortSignal.timeout(7_000) });
    if (!searchResponse.ok) return null;
    const payload = await searchResponse.json() as { results?: { artistName?: string; artistLinkUrl?: string }[] };
    const artist = (payload.results ?? []).find((entry) => normalizedMusicText(entry.artistName ?? "") === normalizedMusicText(name))
      ?? (payload.results ?? [])[0];
    if (!artist?.artistLinkUrl) return null;
    const page = await fetch(artist.artistLinkUrl, { headers: { accept: "text/html" }, next: { revalidate: 604_800 }, signal: AbortSignal.timeout(8_000) });
    if (!page.ok) return null;
    const html = await page.text();
    const match = html.match(/<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image)["'][^>]+content=["']([^"']+)/i)
      ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:og:image|twitter:image)["']/i);
    return match?.[1]?.replaceAll("&amp;", "&") ?? null;
  } catch { return null; }
}

export type MusicArtistTrack = { title: string; album: string; year: string; artworkUrl: string | null; previewUrl: string | null; href?: string };
export type MusicArtistDetails = { id: string; name: string; type: string; disambiguation: string; portraitUrl: string | null; albums: RadarItem[]; tracks: MusicArtistTrack[]; concerts: ArtistConcert[]; concertsConfigured: boolean; concertsAvailable: boolean };

export type ArtistConcert = { id: string; name: string; date: string; venue: string; city: string; url: string };

export async function getUpcomingArtistConcerts(artistName: string): Promise<{ events: ArtistConcert[]; configured: boolean; available: boolean }> {
  const apiKey = process.env.TICKETMASTER_API_KEY;
  if (!apiKey) return { events: [], configured: false, available: true };
  const url = new URL("https://app.ticketmaster.com/discovery/v2/events.json");
  url.search = new URLSearchParams({ keyword: artistName, classificationName: "music", sort: "date,asc", size: "20", apikey: apiKey }).toString();
  try {
    const response = await fetch(url, { next: { revalidate: 21_600 }, signal: AbortSignal.timeout(9_000) });
    if (!response.ok) return { events: [], configured: true, available: false };
    const payload = await response.json() as { _embedded?: { events?: { id?: string; name?: string; url?: string; dates?: { start?: { dateTime?: string; localDate?: string } }; _embedded?: { venues?: { name?: string; city?: { name?: string }; state?: { stateCode?: string } }[] } }[] } };
    const events = (payload._embedded?.events ?? []).flatMap((event) => {
      const venue = event._embedded?.venues?.[0];
      const date = event.dates?.start?.dateTime ?? event.dates?.start?.localDate ?? "";
      return event.id && event.url && date ? [{
        id: event.id, name: event.name ?? "Live event", date, venue: venue?.name ?? "Venue TBA",
        city: [venue?.city?.name, venue?.state?.stateCode].filter(Boolean).join(", "), url: event.url,
      }] : [];
    });
    return { events, configured: true, available: true };
  } catch { return { events: [], configured: true, available: false }; }
}

export async function getMusicArtistDetails(artistId: string): Promise<MusicArtistDetails | null> {
  if (!/^[0-9a-f-]{36}$/i.test(artistId)) return null;
  try {
    const artistUrl = `https://musicbrainz.org/ws/2/artist/${artistId}?inc=tags&fmt=json`;
    const [artistResponse, groupsResponse] = await Promise.all([
      musicBrainzFetch(artistUrl, musicBrainzOptions()),
      musicBrainzFetch(`https://musicbrainz.org/ws/2/release-group/?artist=${artistId}&type=album%7Cep%7Csingle&fmt=json&limit=100&inc=tags`, musicBrainzOptions()),
    ]);
    if (!artistResponse.ok) return null;
    const artist = await artistResponse.json() as { id: string; name?: string; type?: string; disambiguation?: string; area?: { name?: string } };
    const name = artist.name ?? "Artist";
    const [portraitUrl, itunesResponse, recordingsResponse, concertResult] = await Promise.all([
      musicArtistPortrait(name),
      fetch(`https://itunes.apple.com/search?${new URLSearchParams({ term: name, entity: "song", limit: "100", country: "US" })}`, { next: { revalidate: 86_400 }, signal: AbortSignal.timeout(9_000) }).catch(() => null),
      musicBrainzFetch(`https://musicbrainz.org/ws/2/recording/?query=arid:${artistId}&fmt=json&limit=100`, musicBrainzOptions()).catch(() => null),
      getUpcomingArtistConcerts(name),
    ]);
    const records = itunesResponse?.ok ? await itunesResponse.json() as { results?: { trackName?: string; artistName?: string; collectionName?: string; releaseDate?: string; artworkUrl100?: string; previewUrl?: string }[] } : {};
    const recordings = recordingsResponse?.ok ? await recordingsResponse.json() as { recordings?: MusicBrainzRecording[] } : {};
    const mbTracks = new Map((recordings.recordings ?? []).filter((entry) => entry.id && entry.title).map((entry) => [normalizedMusicText(entry.title), entry.id]));
    const tracks = (records.results ?? []).flatMap((track): MusicArtistTrack[] => {
      if (!track.trackName || normalizedMusicText(track.artistName ?? "") !== normalizedMusicText(name)) return [];
      const title = track.trackName;
      const date = track.releaseDate ? new Date(track.releaseDate).getUTCFullYear().toString() : "";
      const image = track.artworkUrl100?.replace(/\d+x\d+bb/, "600x600bb") ?? null;
      const recordingId = mbTracks.get(normalizedMusicText(title));
      return [{ title, album: track.collectionName ?? "", year: date, artworkUrl: image, previewUrl: track.previewUrl ?? null, ...(recordingId ? { href: `/releases/musicbrainz-recording/${recordingId}` } : {}) }];
    });
    const uniqueTracks = [...new Map(tracks.map((track) => [normalizedMusicText(track.title), track])).values()].slice(0, 40);
    const groups = groupsResponse.ok ? (await groupsResponse.json() as { "release-groups"?: MusicBrainzReleaseGroup[] })["release-groups"] ?? [] : [];
    const itunesArtwork = new Map<string, string>();
    for (const track of records.results ?? []) {
      if (!track.collectionName || !track.artworkUrl100) continue;
      const key = normalizedMusicText(track.collectionName);
      if (!itunesArtwork.has(key)) itunesArtwork.set(key, track.artworkUrl100.replace(/\d+x\d+bb/, "600x600bb"));
    }
    const albumByTitle = new Map<string, RadarItem>();
    for (const group of groups) {
      const kind = (group["primary-type"] ?? "").toLowerCase();
      if (!group.id || !group.title || !["album", "ep", "single"].includes(kind)) continue;
      if (isExplicitlyAiGenerated(group.title, name)) continue;
      const date = group["first-release-date"] ?? "";
      const parts = dateParts(date);
      const item: RadarItem = {
        source: "musicbrainz", sourceId: group.id, type: "MUSIC", title: group.title,
        displayDate: date ? formatDate(date) : "Release date not listed",
        releaseDate: parts.exact ? date : null, sortTimestamp: parts.timestamp, isApproximate: !parts.exact,
        posterUrl: itunesArtwork.get(normalizedMusicText(group.title)) ?? `https://coverartarchive.org/release-group/${group.id}/front-500`,
        posterFallbackUrls: [`https://coverartarchive.org/release-group/${group.id}/front`], backdropUrl: null,
        description: `${kind} by ${name}.`, tags: [kind, ...(group["secondary-types"] ?? [])], externalUrl: `https://musicbrainz.org/release-group/${group.id}`,
        tmdbId: null, genreIds: [], popularity: 0, href: `/releases/musicbrainz/${group.id}`,
      };
      const key = `${kind}:${normalizedMusicText(group.title).replace(/\b(?:deluxe|expanded|remastered|reissue|edition)\b/g, "").trim()}`;
      const current = albumByTitle.get(key);
      if (!current || (!current.sortTimestamp && item.sortTimestamp) || ((item.sortTimestamp ?? "") < (current.sortTimestamp ?? ""))) albumByTitle.set(key, item);
    }
    const albums = [...albumByTitle.values()].sort((a, b) => (b.sortTimestamp ?? "").localeCompare(a.sortTimestamp ?? ""));
    return { id: artistId, name, type: artist.type ?? "", disambiguation: artist.disambiguation ?? "", portraitUrl, albums, tracks: uniqueTracks, concerts: concertResult.events, concertsConfigured: concertResult.configured, concertsAvailable: concertResult.available };
  } catch { return null; }
}

export async function getExploreMusicSearch(rawQuery: string): Promise<RadarItem[]> {
  const query = rawQuery.trim().replace(/[\r\n]/g, " ").slice(0, 80);
  if (query.length < 2) return [];
  const exactQuery = query.replace(/[\\"]/g, "");
  const artistUrl = new URL("https://musicbrainz.org/ws/2/artist/");
  artistUrl.searchParams.set("query", `artist:"${exactQuery}"`);
  artistUrl.searchParams.set("fmt", "json");
  artistUrl.searchParams.set("limit", "5");

  try {
    const artistResponse = await musicBrainzFetch(artistUrl, musicBrainzOptions());
    if (!artistResponse.ok) return [];
    const artists = (await artistResponse.json() as { artists?: MusicBrainzArtist[] }).artists ?? [];
    const normalizedQuery = normalizedMusicText(query);
    const artist = artists
      .filter((entry) => Number(entry.score ?? 0) >= 70)
      .sort((a, b) => Number(b.score ?? 0) - Number(a.score ?? 0))
      .find((entry) => normalizedMusicText(entry.name) === normalizedQuery);

    if (!artist) {
      const releaseUrl = new URL("https://musicbrainz.org/ws/2/release-group/");
      releaseUrl.searchParams.set("query", `release:"${exactQuery}"`);
      releaseUrl.searchParams.set("fmt", "json");
      releaseUrl.searchParams.set("limit", "40");
      releaseUrl.searchParams.set("inc", "artists+tags");
      const recordingUrl = new URL("https://musicbrainz.org/ws/2/recording/");
      recordingUrl.searchParams.set("query", `recording:"${exactQuery}"`);
      recordingUrl.searchParams.set("fmt", "json");
      recordingUrl.searchParams.set("limit", "40");
      recordingUrl.searchParams.set("inc", "artists");
      const [releaseResponse, recordingResponse] = await Promise.all([
        musicBrainzFetch(releaseUrl, musicBrainzOptions()),
        musicBrainzFetch(recordingUrl, musicBrainzOptions()),
      ]);
      const result = releaseResponse.ok ? await releaseResponse.json() as { "release-groups"?: Array<MusicBrainzReleaseGroup & { "artist-credit"?: MusicBrainzRelease["artist-credit"] }> } : {};
      const recordingResult = recordingResponse.ok ? await recordingResponse.json() as { recordings?: (MusicBrainzRecording & { "artist-credit"?: MusicBrainzRelease["artist-credit"] })[] } : {};
      const unique = new Map<string, RadarItem>();
      for (const group of result["release-groups"] ?? []) {
        const artistName = group["artist-credit"]?.map((credit) => credit.name ?? credit.artist?.name).filter(Boolean).join(", ") ?? "Unknown artist";
        if (!group.id || !group.title || isExplicitlyAiGenerated(group.title, artistName, ...(group.tags ?? []).map((tag) => tag.name))) continue;
        const item = musicSearchItem({ id: group.id, title: group.title, date: group["first-release-date"] ?? "", artist: artistName, label: group["primary-type"] ?? "Release", image: `https://coverartarchive.org/release-group/${group.id}/front`, description: `${group["primary-type"] ?? "Music release"} by ${artistName}.` });
        const key = `${normalizedMusicText(item.title)}:${normalizedMusicText(artistName)}`;
        if (!unique.has(key)) unique.set(key, item);
      }
      const candidates = artists.filter((entry) => Number(entry.score ?? 0) >= 75).slice(0, 5);
      const artistItems = await Promise.all(candidates.map(async (entry): Promise<RadarItem> => {
        const portrait = await musicArtistPortrait(entry.name);
        return {
          source: "musicbrainz-artist", sourceId: entry.id, type: "MUSIC", title: entry.name,
          displayDate: "Artist", releaseDate: null, sortTimestamp: null, isApproximate: true,
          posterUrl: portrait, backdropUrl: portrait, description: entry.disambiguation || `Music by ${entry.name}.`,
          externalUrl: `https://musicbrainz.org/artist/${entry.id}`, tmdbId: null, genreIds: [], popularity: Number(entry.score ?? 0), href: `/artists/${entry.id}`,
        };
      }));
      const itunesSearch = new URL("https://itunes.apple.com/search");
      itunesSearch.search = new URLSearchParams({ term: query, entity: "song", limit: "100", country: "US" }).toString();
      const itunesResponse = await fetch(itunesSearch, { next: { revalidate: 86_400 }, signal: AbortSignal.timeout(9_000) }).catch(() => null);
      const itunes = itunesResponse?.ok ? await itunesResponse.json() as { results?: { trackName?: string; artistName?: string; artworkUrl100?: string; previewUrl?: string }[] } : {};
      const metadata = new Map<string, { image?: string; preview?: string }>();
      for (const track of itunes.results ?? []) if (track.trackName) metadata.set(normalizedMusicText(track.trackName), {
        image: track.artworkUrl100?.replace(/\d+x\d+bb/, "600x600bb"), preview: track.previewUrl,
      });
      const songs = (recordingResult.recordings ?? []).flatMap((recording): RadarItem[] => {
        const artistName = recording["artist-credit"]?.map((credit) => credit.name ?? credit.artist?.name).filter(Boolean).join(", ") ?? "Unknown artist";
        if (!recording.id || !recording.title || isExplicitlyAiGenerated(recording.title, artistName)) return [];
        const date = recording["first-release-date"] ?? "";
        const match = metadata.get(normalizedMusicText(recording.title));
        return [musicSearchItem({
          id: recording.id, title: recording.title, date, artist: artistName, label: date ? "Song" : "Date not listed",
          image: match?.image, previewUrl: match?.preview,
          description: date ? `Song by ${artistName}.` : `MusicBrainz lists no first-release date for this song by ${artistName}.`,
          source: "musicbrainz-recording",
        })];
      });
      const all = [...artistItems, ...unique.values(), ...songs];
      return [...new Map(all.map((item) => [`${item.source}:${item.sourceId}`, item])).values()];
    }

    const portraitUrl = await musicArtistPortrait(artist.name);
    const artistItem: RadarItem = {
      source: "musicbrainz-artist", sourceId: artist.id, type: "MUSIC", title: artist.name,
      displayDate: "Artist", releaseDate: null, sortTimestamp: null, isApproximate: true,
      posterUrl: portraitUrl, backdropUrl: portraitUrl, description: artist.disambiguation || `Music by ${artist.name}.`,
      externalUrl: `https://musicbrainz.org/artist/${artist.id}`, tmdbId: null, genreIds: [], popularity: Number(artist.score ?? 0),
      href: `/artists/${artist.id}`,
    };

    const groupsUrl = new URL("https://musicbrainz.org/ws/2/release-group/");
    groupsUrl.searchParams.set("artist", artist.id);
    groupsUrl.searchParams.set("type", "album|ep|single");
    groupsUrl.searchParams.set("fmt", "json");
    groupsUrl.searchParams.set("limit", "100");
    groupsUrl.searchParams.set("inc", "tags");

    const recordingsUrl = new URL("https://musicbrainz.org/ws/2/recording/");
    recordingsUrl.searchParams.set("query", `arid:${artist.id}`);
    recordingsUrl.searchParams.set("fmt", "json");
    recordingsUrl.searchParams.set("limit", "100");

    const itunesUrl = new URL("https://itunes.apple.com/search");
    itunesUrl.search = new URLSearchParams({ term: artist.name, entity: "song", limit: "200", country: "US" }).toString();
    const [groupsResponse, recordingsResponse, itunesResponse] = await Promise.all([
      musicBrainzFetch(groupsUrl, musicBrainzOptions()),
      musicBrainzFetch(recordingsUrl, musicBrainzOptions()),
      fetch(itunesUrl, { next: { revalidate: 86_400 }, signal: AbortSignal.timeout(12_000) }).catch(() => null),
    ]);
    if (!groupsResponse.ok || !recordingsResponse.ok) return [artistItem];
    const groups = (await groupsResponse.json() as { "release-groups"?: MusicBrainzReleaseGroup[] })["release-groups"] ?? [];
    const recordings = (await recordingsResponse.json() as { recordings?: MusicBrainzRecording[] }).recordings ?? [];
    const songArtwork = new Map<string, string>();
    const songPreview = new Map<string, string>();
    if (itunesResponse?.ok) {
      const lookup = await itunesResponse.json() as { results?: { trackName?: string; collectionName?: string; artworkUrl100?: string; previewUrl?: string }[] };
      for (const track of lookup.results ?? []) {
        if (!track.trackName || !track.artworkUrl100) continue;
        const key = normalizedMusicText(track.trackName);
        if (!songArtwork.has(key)) songArtwork.set(key, track.artworkUrl100.replace(/\d+x\d+bb/, "600x600bb"));
        if (track.previewUrl && !songPreview.has(key)) songPreview.set(key, track.previewUrl);
      }
    }

    const releaseMap = new Map<string, RadarItem>();
    for (const group of groups) {
      const releaseType = group["primary-type"] ?? "Release";
      if (!group.id || !group.title || !["album", "ep", "single"].includes(releaseType.toLowerCase())) continue;
      if (isExplicitlyAiGenerated(group.title, artist.name, ...(group.tags ?? []).map((tag) => tag.name))) continue;
      const item = musicSearchItem({ id: group.id, title: group.title, date: group["first-release-date"] ?? "", artist: artist.name, label: releaseType, image: `https://coverartarchive.org/release-group/${group.id}/front-500`, description: `${releaseType} by ${artist.name}.` });
      const key = `${normalizedMusicText(group.title).replace(/\b(?:deluxe|expanded|remastered|reissue|edition)\b/g, "").trim()}:${releaseType.toLowerCase()}`;
      const current = releaseMap.get(key);
      if (!current || (!current.sortTimestamp && item.sortTimestamp)) releaseMap.set(key, item);
    }
    const releases = [...releaseMap.values()];

    const uniqueTracks = new Map<string, MusicBrainzRecording>();
    for (const recording of recordings) {
      if (!recording.id || !recording.title || isExplicitlyAiGenerated(recording.title, artist.name)) continue;
      const key = normalizedMusicText(recording.title);
      const previous = uniqueTracks.get(key);
      if (!previous || (!previous["first-release-date"] && recording["first-release-date"]) || (/\blive\b/i.test(previous.disambiguation ?? "") && !/\blive\b/i.test(recording.disambiguation ?? ""))) {
        uniqueTracks.set(key, recording);
      }
    }
    const tracks = [...uniqueTracks.values()].map((recording) => {
      const date = recording["first-release-date"] ?? "";
      const unreleased = !date;
      return musicSearchItem({
        id: recording.id, title: recording.title, date, artist: artist.name,
        label: unreleased ? "Date not listed" : "Song",
        image: songArtwork.get(normalizedMusicText(recording.title)),
        previewUrl: songPreview.get(normalizedMusicText(recording.title)),
        description: unreleased
          ? `A cataloged ${artist.name} recording with no first-release date listed in MusicBrainz. This does not confirm that it is unreleased.`
          : `Track by ${artist.name}.`,
        source: "musicbrainz-recording",
      });
    });

    return [artistItem, ...releases, ...tracks].sort((a, b) => {
      if (a.source === "musicbrainz-artist") return -1;
      if (b.source === "musicbrainz-artist") return 1;
      if (a.source === "musicbrainz-recording" && b.source !== "musicbrainz-recording") return 1;
      if (a.source !== "musicbrainz-recording" && b.source === "musicbrainz-recording") return -1;
      if (a.source === "musicbrainz-recording" && b.source === "musicbrainz-recording") {
        const aUnreleased = a.displayDate.startsWith("Unreleased");
        const bUnreleased = b.displayDate.startsWith("Unreleased");
        return Number(aUnreleased) - Number(bUnreleased) || a.title.localeCompare(b.title);
      }
      return (b.releaseDate ?? "").localeCompare(a.releaseDate ?? "") || a.title.localeCompare(b.title);
    });
  } catch {
    return [];
  }
}

export async function getExploreShelves(type: ExploreType, options: { year?: number; sort?: "popular" | "rated" } = {}): Promise<RadarShelf[]> {
  return Promise.all(discoverShelves[type].map(async (shelf) => ({
    ...shelf,
    items: await getExploreRadar(type, { genre: shelf.value, year: options.year, sort: options.sort, page: 1 }),
  })));
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
    return { iso: `${quarter[2]}-${String(month).padStart(2, "0")}-01`, label: `${label} · Day TBA`, approximate: true };
  }
  if (/^20\d{2}$/.test(label)) return { iso: `${label}-01-01`, label: `${label} · Date TBA`, approximate: true };
  if (/^20\d{2}-\d{2}$/.test(label)) {
    const date = new Date(`${label}-01T12:00:00Z`);
    return { iso: `${label}-01`, label: `${date.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" })} · Day TBA`, approximate: true };
  }
  const date = Date.parse(label);
  if (!Number.isFinite(date)) return { iso: null, label, approximate: true };
  const parsed = new Date(date);
  const iso = `${parsed.getUTCFullYear()}-${String(parsed.getUTCMonth() + 1).padStart(2, "0")}-${String(parsed.getUTCDate()).padStart(2, "0")}`;
  return { iso, label, approximate: !/\b\d{1,2},?\s+20\d{2}\b/.test(label) };
}

export function parseSteamCards(html: string, options: { upcomingOnly?: boolean; offset?: number } = {}) {
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
    const libraryArt = `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${id}/library_600x900_2x.jpg`;
    const libraryArtFallback = `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${id}/library_600x900.jpg`;
    const cdnArt = `https://cdn.cloudflare.steamstatic.com/steam/apps/${id}/library_600x900.jpg`;
    const headerArt = `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${id}/header.jpg`;
    const alternateHeaderArt = `https://cdn.cloudflare.steamstatic.com/steam/apps/${id}/header.jpg`;
    const scoreText = decodeHtml(card.match(/data-tooltip-html=["']([^"']+)["']/i)?.[1] ?? "")
      .replace(/<br\s*\/?>/gi, " · ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const ratingLabel = scoreText.match(/(?:overwhelmingly|very|mostly)\s+(?:positive|negative)|mixed|positive|negative/i)?.[0];
    const displayDate = release.label;
    return [{
      source: "steam", sourceId: id, type: "GAME", title: cleanTitle,
      displayDate, releaseDate: release.approximate ? null : release.iso,
      sortTimestamp: release.iso ? `${release.iso}T12:00:00.000Z` : null,
      isApproximate: release.approximate, posterUrl: headerArt,
      posterFallbackUrls: [alternateHeaderArt, libraryArt, libraryArtFallback, cdnArt, `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${id}/capsule_616x353.jpg`, ...(poster ? [decodeHtml(poster)] : [])],
      backdropUrl: null, description: "Steam game listing.",
      externalUrl: decodeHtml(href), tmdbId: null, genreIds: [],
      popularity: 1 / ((options.offset ?? 0) + index + 1),
      ...(ratingLabel ? { ratingLabel, ratingSource: "Steam reviews" } : {}),
      href: `/releases/steam/${id}`,
    }];
  });
}

async function getUpcomingGames(): Promise<RadarItem[]> {
  try {
    const [steamPages, rawgGames, gogGames] = await Promise.all([Promise.all([0, 50, 100, 150].map(async (offset) => {
      const url = new URL("https://store.steampowered.com/search/results/");
      url.search = new URLSearchParams({ query: "", start: String(offset), count: "50", dynamic_data: "", sort_by: "_ASC", filter: "popularcomingsoon", infinite: "1", cc: "us", l: "english" }).toString();
      const response = await fetch(url, {
        headers: { accept: "application/json", "user-agent": "HorizonReleaseRadar/1.0" },
        next: { revalidate: 3600 }, signal: AbortSignal.timeout(9_000),
      });
      if (!response.ok) return [];
      const payload = await response.json() as SteamSearchResponse;
      return parseSteamCards(payload.results_html ?? "", { upcomingOnly: true, offset });
    })), getRawgUpcomingGames(), getGogUpcomingGames()]);
    const merged = [...steamPages.flat(), ...rawgGames, ...gogGames];
    return [...new Map(merged.map((game) => [normalizedMusicText(game.title), game])).values()]
      .sort((a, b) => (a.sortTimestamp ?? "9999").localeCompare(b.sortTimestamp ?? "9999") || b.popularity - a.popularity);
  } catch {
    return [];
  }
}

async function getGogUpcomingGames(): Promise<RadarItem[]> {
  const url = new URL("https://catalog.gog.com/v1/catalog");
  url.search = new URLSearchParams({ limit: "100", order: "desc:releaseDate", productType: "in:game" }).toString();
  try {
    const response = await fetch(url, { headers: { accept: "application/json" }, next: { revalidate: 3600 }, signal: AbortSignal.timeout(12_000) });
    if (!response.ok) return [];
    const payload = await response.json() as { products?: {
      id?: string; title?: string; releaseDate?: string | null; productState?: string; coverVertical?: string; coverHorizontal?: string;
      galaxyBackgroundImage?: string; screenshots?: string[]; genres?: { name?: string }[]; tags?: { name?: string }[];
      developers?: string[]; publishers?: string[]; storeLink?: string;
    }[] };
    const today = new Date().toISOString().slice(0, 10);
    return (payload.products ?? []).flatMap((game): RadarItem[] => {
      if (!game.id || !game.title || game.productState !== "coming-soon" || !game.coverVertical || !game.storeLink || isExplicitlyAiGenerated(game.title)) return [];
      const date = game.releaseDate?.replaceAll(".", "-") ?? "";
      if (date && /^\d{4}-\d{2}-\d{2}$/.test(date) && date < today) return [];
      const exact = /^\d{4}-\d{2}-\d{2}$/.test(date);
      const categories = (game.genres ?? []).map((entry) => entry.name ?? "").filter(Boolean);
      const details = [game.developers?.length ? `Developer: ${game.developers.join(", ")}.` : "", game.publishers?.length ? `Publisher: ${game.publishers.join(", ")}.` : ""].filter(Boolean).join(" ");
      return [{
        source: "gog", sourceId: game.id, type: "GAME", title: game.title,
        displayDate: date ? formatDate(date) : "Coming soon · Date TBA", releaseDate: exact ? date : null,
        sortTimestamp: dateParts(date).timestamp, isApproximate: !exact,
        posterUrl: game.coverVertical, posterFallbackUrls: [...(game.screenshots ?? []), ...(game.coverHorizontal ? [game.coverHorizontal] : [])],
        backdropUrl: game.galaxyBackgroundImage ?? game.screenshots?.[0] ?? game.coverHorizontal ?? null,
        description: ["Upcoming game listed by GOG.", details].filter(Boolean).join(" "), tags: categories,
        externalUrl: game.storeLink, tmdbId: null, genreIds: [], popularity: 0, href: `/releases/gog/${game.id}`,
      }];
    });
  } catch { return []; }
}

async function getRawgUpcomingGames(): Promise<RadarItem[]> {
  const key = process.env.RAWG_API_KEY;
  if (!key) return [];
  const today = new Date();
  const from = today.toISOString().slice(0, 10);
  const end = new Date(today);
  end.setUTCFullYear(end.getUTCFullYear() + 3);
  const url = new URL("https://api.rawg.io/api/games");
  url.search = new URLSearchParams({ key, dates: `${from},${end.toISOString().slice(0, 10)}`, ordering: "released", page_size: "40", page: "1" }).toString();
  try {
    const response = await fetch(url, { headers: { accept: "application/json" }, next: { revalidate: 3600 }, signal: AbortSignal.timeout(9_000) });
    if (!response.ok) return [];
    const payload = await response.json() as { results?: { id?: number; slug?: string; name?: string; released?: string; background_image?: string; rating?: number; ratings_count?: number; metacritic?: number; short_screenshots?: { image?: string }[] }[] };
    return (payload.results ?? []).flatMap((game): RadarItem[] => {
      if (!game.id || !game.slug || !game.name || !game.background_image || isExplicitlyAiGenerated(game.name)) return [];
      const date = game.released ?? "";
      const exact = /^\d{4}-\d{2}-\d{2}$/.test(date);
      return [{
        source: "rawg", sourceId: String(game.id), type: "GAME", title: game.name,
        displayDate: date ? formatDate(date) : "Release date TBA", releaseDate: exact ? date : null,
        sortTimestamp: dateParts(date).timestamp, isApproximate: !exact,
        posterUrl: game.background_image, posterFallbackUrls: (game.short_screenshots ?? []).map((shot) => shot.image ?? "").filter(Boolean),
        backdropUrl: game.background_image, description: "Upcoming game listing from RAWG.",
        externalUrl: `https://rawg.io/games/${game.slug}`, tmdbId: null, genreIds: [],
        popularity: (game.ratings_count ?? 0) + (game.metacritic ?? 0) * 100 + (game.rating ?? 0),
        ...(game.rating ? { voteAverage: game.rating, ratingScale: 5 as const, ratingSource: "RAWG" } : {}), href: `/releases/rawg/${game.slug}`,
      }];
    });
  } catch { return []; }
}

async function getSteamTopSellers(): Promise<RadarItem[]> {
  try {
    const response = await fetch("https://store.steampowered.com/api/featuredcategories?cc=us&l=en", {
      headers: { accept: "application/json", "user-agent": "HorizonReleaseRadar/1.0" },
      next: { revalidate: 3600 }, signal: AbortSignal.timeout(9_000),
    });
    if (!response.ok) return [];
    const payload = await response.json() as { top_sellers?: { items?: {
      id?: number; name?: string; large_capsule_image?: string; small_capsule_image?: string; header_image?: string;
    }[] } };
    return (payload.top_sellers?.items ?? []).flatMap((entry, index): RadarItem[] => {
      const appId = entry.id ? String(entry.id) : "";
      if (!appId || !entry.name || isExplicitlyAiGenerated(entry.name)) return [];
      const headerArt = entry.header_image ?? `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appId}/header.jpg`;
      const libraryArt = `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appId}/library_600x900_2x.jpg`;
      const libraryArtFallback = `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appId}/library_600x900.jpg`;
      return [{
        source: "steam", sourceId: appId, type: "GAME", title: entry.name,
        displayDate: "Trending on Steam", releaseDate: null, sortTimestamp: null, isApproximate: true,
        posterUrl: headerArt,
        posterFallbackUrls: [libraryArt, libraryArtFallback, entry.large_capsule_image, entry.small_capsule_image].filter((value): value is string => Boolean(value)),
        backdropUrl: entry.header_image ?? null, description: "A current top seller on Steam.",
        externalUrl: `https://store.steampowered.com/app/${appId}/`, tmdbId: null, genreIds: [],
        popularity: 1 / (index + 1), href: `/releases/steam/${appId}`,
      }];
    });
  } catch {
    return [];
  }
}

async function searchRawgGames(query: string, page: number): Promise<RadarItem[]> {
  const key = process.env.RAWG_API_KEY;
  if (!key || !query.trim()) return [];
  const url = new URL("https://api.rawg.io/api/games");
  url.search = new URLSearchParams({ key, search: query.trim().slice(0, 80), ordering: "-rating", page_size: "40", page: String(Math.min(20, Math.max(1, page))) }).toString();
  try {
    const response = await fetch(url, { headers: { accept: "application/json" }, next: { revalidate: 86_400 }, signal: AbortSignal.timeout(9_000) });
    if (!response.ok) return [];
    const payload = await response.json() as { results?: { id?: number; slug?: string; name?: string; released?: string; background_image?: string; rating?: number; ratings_count?: number; metacritic?: number; short_screenshots?: { image?: string }[] }[] };
    return (payload.results ?? []).flatMap((game): RadarItem[] => {
      if (!game.id || !game.slug || !game.name || !game.background_image || isExplicitlyAiGenerated(game.name)) return [];
      const date = game.released ?? "";
      const exact = /^\d{4}-\d{2}-\d{2}$/.test(date);
      return [{
        source: "rawg", sourceId: String(game.id), type: "GAME", title: game.name,
        displayDate: date ? formatDate(date) : "Release date not listed", releaseDate: exact ? date : null,
        sortTimestamp: dateParts(date).timestamp, isApproximate: !exact,
        posterUrl: game.background_image, posterFallbackUrls: (game.short_screenshots ?? []).map((shot) => shot.image ?? "").filter(Boolean),
        backdropUrl: game.background_image, description: "Game catalog entry from RAWG.",
        externalUrl: `https://rawg.io/games/${game.slug}`, tmdbId: null, genreIds: [],
        popularity: (game.ratings_count ?? 0) + (game.metacritic ?? 0) * 100 + (game.rating ?? 0),
        ...(game.rating ? { voteAverage: game.rating, ratingScale: 5 as const, ratingSource: "RAWG" } : {}),
        href: `/releases/rawg/${game.slug}`,
      }];
    });
  } catch { return []; }
}

async function getExploreGames(year: number | undefined, sort: "popular" | "rated", page: number, genre?: string, query?: string): Promise<RadarItem[]> {
  try {
    if (!query && !genre && !year && page === 1 && sort === "popular") {
      const featured = await getSteamTopSellers();
      if (featured.length) return featured;
    }
    const offsets = year ? [0, 50, 100, 150, 200, 250, 300, 350] : [(Math.max(1, page) - 1) * 50];
    const tag = genre?.match(/^tag:(\d+)$/)?.[1];
    const results = await Promise.all(offsets.map(async (offset) => {
      const url = new URL("https://store.steampowered.com/search/results/");
      url.search = new URLSearchParams({
        query: query?.trim().slice(0, 80) ?? "", start: String(offset), count: "50", dynamic_data: "", sort_by: "Reviews_DESC",
        infinite: "1", cc: "us", l: "english", ...(tag ? { tags: tag } : {}),
      }).toString();
      const response = await fetch(url, {
        headers: { accept: "application/json", "user-agent": "HorizonReleaseRadar/1.0" },
        next: { revalidate: 86_400 }, signal: AbortSignal.timeout(9_000),
      });
      if (!response.ok) return [];
      const payload = await response.json() as SteamSearchResponse;
      return parseSteamCards(payload.results_html ?? "", { offset });
    }));
    const rawgResults = query ? await searchRawgGames(query, page) : [];
    const unique = new Map<string, RadarItem>();
    for (const item of [...results.flat(), ...rawgResults]) {
      if (year && item.sortTimestamp?.slice(0, 4) !== String(year)) continue;
      if (!unique.has(item.sourceId)) unique.set(item.sourceId, item);
    }
    const selected = [...unique.values()].sort((a, b) => sort === "rated"
      ? ((b.voteAverage ?? 0) / (b.ratingScale ?? 10)) - ((a.voteAverage ?? 0) / (a.ratingScale ?? 10)) || b.popularity - a.popularity
      : b.popularity - a.popularity);
    return year ? selected.filter((item) => item.sortTimestamp?.slice(0, 4) === String(year)).slice((Math.max(1, page) - 1) * 50, Math.max(1, page) * 50) : selected;
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
    tags?: { count?: number; name?: string }[];
  };
};

function mapAlbumRelease(release: MusicBrainzRelease, group: NonNullable<MusicBrainzRelease["release-group"]>, date: string): RadarItem {
  const artist = release["artist-credit"]?.map((credit) => credit.name ?? credit.artist?.name).filter(Boolean).join(", ");
  const canonicalDate = group["first-release-date"] || date;
  const exactDay = /^\d{4}-\d{2}-\d{2}$/.test(canonicalDate);
  const dateForParsing = `${canonicalDate}${canonicalDate.length === 4 ? "-01-01" : canonicalDate.length === 7 ? "-01" : ""}`;
  const dateValue = new Date(`${dateForParsing}T12:00:00Z`);
  const dateLabel = formatDate(canonicalDate);
  return {
    source: "musicbrainz", sourceId: group.id, type: "MUSIC", title: group.title,
    displayDate: dateLabel,
    releaseDate: exactDay ? canonicalDate : null,
    sortTimestamp: Number.isFinite(dateValue.getTime()) ? dateValue.toISOString() : null,
    isApproximate: !exactDay,
    posterUrl: `https://coverartarchive.org/release-group/${group.id}/front`,
    backdropUrl: null,
    description: artist ? `Album by ${artist}.` : "Music release.",
    externalUrl: `https://musicbrainz.org/release-group/${group.id}`, tmdbId: null,
    genreIds: [], popularity: Number(release.score ?? 0),
    tags: (group.tags ?? []).map((tag) => tag.name ?? "").filter(Boolean),
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
  if (!uniqueIds.length) return new Map<string, { listeners: number; plays: number }>();
  try {
    const response = await fetch(`https://api.listenbrainz.org/1/popularity/${kind}`, {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify({ [`${kind.replace("-", "_")}_mbids`]: uniqueIds }),
      next: { revalidate: 86_400 }, signal: AbortSignal.timeout(9_000),
    });
    if (!response.ok) return new Map<string, { listeners: number; plays: number }>();
    const payload = await response.json() as Record<string, unknown>[];
    const idField = `${kind.replace("-", "_")}_mbid`;
    return new Map<string, { listeners: number; plays: number }>(payload.flatMap((entry) => {
      const id = typeof entry[idField] === "string" ? entry[idField] as string : "";
      const listeners = Number(entry.total_user_count ?? 0);
      const plays = Number(entry.total_listen_count ?? 0);
      return id ? [[id, { listeners, plays }] as const] : [];
    }));
  } catch {
    return new Map<string, { listeners: number; plays: number }>();
  }
}

export async function getUpcomingAlbums(country = "US", genre = ""): Promise<RadarItem[]> {
  const start = new Date();
  const end = new Date(start);
  end.setUTCFullYear(end.getUTCFullYear() + 2);
  const today = start.toISOString().slice(0, 10);
  const limit = end.toISOString().slice(0, 10);
  const genreTag = /^tag:[\w& -]+$/.test(genre) ? genre.slice(4) : "";
  const query = `country:${country} AND date:[${today} TO ${limit}] AND status:official${genreTag ? ` AND tag:"${genreTag}"` : ""}`;
  const url = new URL("https://musicbrainz.org/ws/2/release/");
  url.searchParams.set("query", query);
  url.searchParams.set("fmt", "json");
  url.searchParams.set("limit", "100");
  url.searchParams.set("inc", "release-groups");

  try {
    const response = await musicBrainzFetch(url, musicBrainzOptions());
    if (!response.ok) return [];
    const payload = await response.json() as { releases?: MusicBrainzRelease[] };
    const grouped = new Map<string, { release: MusicBrainzRelease; date: string; group: NonNullable<MusicBrainzRelease["release-group"]> }>();
    for (const release of payload.releases ?? []) {
      const group = release["release-group"];
      const date = release.date ?? group?.["first-release-date"] ?? "";
      if (release.country && release.country !== country) continue;
      if (!group?.id || !["album", "single", "ep"].includes((group["primary-type"] ?? "").toLowerCase())) continue;
      const creditedArtist = release["artist-credit"]?.map((credit) => credit.name ?? credit.artist?.name).filter(Boolean).join(", ") ?? "";
      if (isSoundtrackOrCompilation(group, group.title, creditedArtist)) continue;
      if (isExplicitlyAiGenerated(group.title, creditedArtist, ...(group.tags ?? []).map((tag) => tag.name))) continue;
      if (!date || date < today.slice(0, date.length) || date > limit.slice(0, date.length)) continue;
      const existing = grouped.get(group.id);
      if (!existing || date.length > existing.date.length) grouped.set(group.id, { release, date, group });
    }
    return [...grouped.values()].map(({ release, date, group }) => mapAlbumRelease(release, group, date))
      .sort((a, b) => (a.sortTimestamp ?? "").localeCompare(b.sortTimestamp ?? "") || b.popularity - a.popularity);
  } catch {
    return [];
  }
}

async function getExploreAlbums(year: number | undefined, sort: "popular" | "rated", page: number, genre?: string): Promise<RadarItem[]> {
  const from = year ? `${year}-01-01` : "1900-01-01";
  const to = year ? `${year}-12-31` : `${new Date().getFullYear()}-12-31`;
  const genreTag = genre?.startsWith("tag:") ? genre.slice(4) : "";
  const genreQuery = genreTag ? ` AND tag:\"${genreTag.replaceAll('"', "")}\"` : "";
  const query = `country:US AND date:[${from} TO ${to}] AND status:official AND primarytype:album${genreQuery}`;
  const url = new URL("https://musicbrainz.org/ws/2/release/");
  url.searchParams.set("query", query);
  url.searchParams.set("fmt", "json");
  url.searchParams.set("limit", "100");
  url.searchParams.set("offset", String((Math.max(1, page) - 1) * 100));
  url.searchParams.set("inc", "release-groups");
  try {
    const response = await musicBrainzFetch(url, musicBrainzOptions());
    if (!response.ok) return [];
    const payload = await response.json() as { releases?: MusicBrainzRelease[] };
    const grouped = new Map<string, { item: RadarItem; score: number }>();
    for (const release of payload.releases ?? []) {
      const group = release["release-group"];
      const date = group?.["first-release-date"] ?? release.date ?? "";
      if (release.country && release.country !== "US") continue;
      if (!group?.id || group["primary-type"]?.toLowerCase() !== "album") continue;
      if (year && date.slice(0, 4) !== String(year)) continue;
      const artist = release["artist-credit"]?.map((credit) => credit.name ?? credit.artist?.name).filter(Boolean).join(", ") ?? "";
      if (isSoundtrackOrCompilation(group, group.title, artist)) continue;
      if (isExplicitlyAiGenerated(group.title, artist, ...(group.tags ?? []).map((tag) => tag.name))) continue;
      const item = mapAlbumRelease(release, group, date);
      const score = Number(release.score ?? 0);
      const current = grouped.get(group.id);
      if (!current || score > current.score) grouped.set(group.id, { item, score });
    }
    const candidates = [...grouped.values()].map(({ item }) => item);
    const popularity = await listenBrainzPopularity("release-group", candidates.map((item) => item.sourceId));
    const withAudience = candidates.flatMap((item) => {
      const stats = popularity.get(item.sourceId);
      if (!stats?.listeners) return [];
      return [{ item: { ...item, popularity: stats.listeners }, replayRate: stats.plays / stats.listeners }];
    });
    return withAudience.sort((a, b) => sort === "rated"
      ? b.replayRate - a.replayRate || b.item.popularity - a.item.popularity
      : b.item.popularity - a.item.popularity || a.item.title.localeCompare(b.item.title))
      .map(({ item }) => item);
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
  platforms: string[];
  systemRequirements: { platform: string; minimum: string; recommended: string }[];
  website: string | null;
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
  platforms?: { windows?: boolean; mac?: boolean; linux?: boolean };
  pc_requirements?: { minimum?: string; recommended?: string };
  website?: string;
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
      platforms: [data.platforms?.windows ? "Windows" : "", data.platforms?.mac ? "macOS" : "", data.platforms?.linux ? "Linux" : ""].filter(Boolean),
      systemRequirements: data.pc_requirements?.minimum || data.pc_requirements?.recommended ? [{ platform: "Windows", minimum: data.pc_requirements.minimum ?? "", recommended: data.pc_requirements.recommended ?? "" }] : [],
      website: data.website && /^https?:\/\//i.test(data.website) ? data.website : null,
    };
  } catch {
    return null;
  }
}

export type RawgGameDetails = {
  id: string;
  slug: string;
  name: string;
  released: string;
  backgroundImage: string | null;
  description: string;
  rating: number | null;
  ratingsCount: number;
  metacritic: number | null;
  genres: string[];
  developers: string[];
  publishers: string[];
  website: string | null;
  screenshots: string[];
  trailers: { name: string; poster: string; webm: string | null; mp4: string | null }[];
  platforms: string[];
};

export async function getRawgGameDetails(slug: string): Promise<RawgGameDetails | null> {
  const key = process.env.RAWG_API_KEY;
  if (!key || !/^[a-z0-9-]{1,180}$/i.test(slug)) return null;
  const url = new URL(`https://api.rawg.io/api/games/${encodeURIComponent(slug)}`);
  url.searchParams.set("key", key);
  try {
    const requestOptions = { headers: { accept: "application/json" }, next: { revalidate: 86_400 }, signal: AbortSignal.timeout(9_000) };
    const extra = (endpoint: string) => fetch(`https://api.rawg.io/api/games/${encodeURIComponent(slug)}/${endpoint}?${new URLSearchParams({ key, page_size: "12" })}`, requestOptions).then(async (response) => response.ok ? response.json() : null).catch(() => null);
    const [response, shots, movies] = await Promise.all([fetch(url, requestOptions), extra("screenshots"), extra("movies")]);
    if (!response.ok) return null;
    const game = await response.json() as {
      id?: number; slug?: string; name?: string; released?: string; background_image?: string | null;
      description_raw?: string; description?: string; rating?: number; ratings_count?: number; metacritic?: number | null;
      genres?: { name?: string }[]; developers?: { name?: string }[]; publishers?: { name?: string }[]; website?: string;
      platforms?: { platform?: { name?: string } }[];
    };
    if (!game.id || !game.slug || !game.name) return null;
    const safeWebsite = game.website && /^https?:\/\//i.test(game.website) ? game.website : null;
    return {
      id: String(game.id), slug: game.slug, name: game.name, released: game.released ?? "",
      backgroundImage: game.background_image ?? null,
      description: game.description_raw ?? game.description ?? "Game details from RAWG.",
      rating: typeof game.rating === "number" ? game.rating : null,
      ratingsCount: game.ratings_count ?? 0, metacritic: game.metacritic ?? null,
      genres: (game.genres ?? []).map((entry) => entry.name ?? "").filter(Boolean),
      developers: (game.developers ?? []).map((entry) => entry.name ?? "").filter(Boolean),
      publishers: (game.publishers ?? []).map((entry) => entry.name ?? "").filter(Boolean), website: safeWebsite,
      screenshots: ((shots as { results?: { image?: string }[] } | null)?.results ?? []).map((shot) => shot.image ?? "").filter((image) => /^https:\/\//.test(image)).slice(0, 12),
      trailers: ((movies as { results?: { name?: string; preview?: string; data?: { max?: string; "480"?: string } }[] } | null)?.results ?? []).map((movie) => ({ name: movie.name ?? "Trailer", poster: movie.preview ?? "", webm: null, mp4: movie.data?.max ?? movie.data?.["480"] ?? null })).filter((movie) => Boolean(movie.mp4 && /^https?:\/\//.test(movie.mp4))).slice(0, 6),
      platforms: (game.platforms ?? []).map((entry) => entry.platform?.name ?? "").filter(Boolean),
    };
  } catch { return null; }
}

export type MusicReleaseDetails = {
  id: string;
  title: string;
  artist: string;
  artistId: string | null;
  releaseDate: string;
  history: string | null;
  historyUrl: string | null;
  tags: string[];
  coverUrl: string;
  coverFallbackUrls: string[];
  tracks: { title: string; artist: string; previewUrl: string | null; artworkUrl: string | null }[];
};

export type MusicRecordingDetails = {
  id: string;
  title: string;
  artist: string;
  firstReleaseDate: string;
  disambiguation: string;
  length: number | null;
  artworkUrl: string | null;
  previewUrl: string | null;
};

type MusicBrainzGroupDetails = {
  id: string;
  title?: string;
  "first-release-date"?: string;
  "artist-credit"?: { name?: string; artist?: { id?: string; name?: string } }[];
  tags?: { name?: string; count?: number }[];
};

async function musicHistory(title: string, artist: string) {
  try {
    const query = new URL("https://en.wikipedia.org/w/api.php");
    query.search = new URLSearchParams({ action: "query", list: "search", srsearch: `"${title}" "${artist}" album`, srlimit: "5", format: "json" }).toString();
    const search = await fetch(query, { headers: { accept: "application/json", "user-agent": "HorizonReleaseRadar/1.0 (personal release calendar)" }, next: { revalidate: 604_800 }, signal: AbortSignal.timeout(7_000) });
    if (!search.ok) return { summary: null, url: null };
    const result = await search.json() as { query?: { search?: { title?: string }[] } };
    const expected = normalizedMusicText(title);
    const article = result.query?.search?.find((entry) => entry.title && normalizedMusicText(entry.title).includes(expected))?.title;
    if (!article) return { summary: null, url: null };
    const summaryResponse = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(article.replaceAll(" ", "_"))}`, { headers: { accept: "application/json" }, next: { revalidate: 604_800 }, signal: AbortSignal.timeout(7_000) });
    if (!summaryResponse.ok) return { summary: null, url: `https://en.wikipedia.org/wiki/${encodeURIComponent(article.replaceAll(" ", "_"))}` };
    const summary = await summaryResponse.json() as { extract?: string; content_urls?: { desktop?: { page?: string } } };
    return { summary: summary.extract?.slice(0, 1800) ?? null, url: summary.content_urls?.desktop?.page ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(article.replaceAll(" ", "_"))}` };
  } catch { return { summary: null, url: null }; }
}

export async function getMusicReleaseDetails(groupId: string): Promise<MusicReleaseDetails | null> {
  if (!/^[0-9a-f-]{36}$/i.test(groupId)) return null;
  try {
    const response = await musicBrainzFetch(`https://musicbrainz.org/ws/2/release-group/${groupId}?inc=artists+tags&fmt=json`, musicBrainzOptions());
    if (!response.ok) return null;
    const group = await response.json() as MusicBrainzGroupDetails;
    const artist = group["artist-credit"]?.map((credit) => credit.name ?? credit.artist?.name).filter(Boolean).join(", ") ?? "Unknown artist";
    const artistId = group["artist-credit"]?.find((credit) => credit.artist?.id)?.artist?.id ?? null;
    const title = group.title ?? "Music release";
    const term = new URLSearchParams({ term: `${artist} ${title}`, entity: "album", limit: "10", country: "US" });
    const lookup = await fetch(`https://itunes.apple.com/search?${term}`, { next: { revalidate: 86_400 }, signal: AbortSignal.timeout(8_000) });
    const lookupPayload = lookup.ok ? await lookup.json() as { results?: { collectionId?: number; collectionName?: string; artistName?: string; artworkUrl100?: string }[] } : {};
    const normalizedTitle = normalizedMusicText(title);
    const album = (lookupPayload.results ?? []).find((entry) => normalizedMusicText(entry.collectionName ?? "") === normalizedTitle)
      ?? (lookupPayload.results ?? []).find((entry) => normalizedMusicText(entry.collectionName ?? "").includes(normalizedTitle));
    const artwork = album?.artworkUrl100?.replace(/\d+x\d+bb/, "600x600bb") ?? null;
    const [tracksResponse, history] = await Promise.all([
      album?.collectionId ? fetch(`https://itunes.apple.com/lookup?id=${album.collectionId}&entity=song&country=US`, { next: { revalidate: 86_400 }, signal: AbortSignal.timeout(8_000) }).catch(() => null) : null,
      musicHistory(title, artist),
    ]);
    const trackPayload = tracksResponse?.ok ? await tracksResponse.json() as { results?: { wrapperType?: string; trackName?: string; artistName?: string; previewUrl?: string; artworkUrl100?: string }[] } : {};
    return {
      id: groupId,
      title,
      artist,
      artistId,
      releaseDate: group["first-release-date"] ?? "Release date unavailable",
      history: history.summary,
      historyUrl: history.url,
      tags: (group.tags ?? []).slice().sort((a, b) => (b.count ?? 0) - (a.count ?? 0)).slice(0, 8).map((tag) => tag.name ?? "").filter(Boolean),
      coverUrl: artwork ?? `https://coverartarchive.org/release-group/${groupId}/front-500`,
      coverFallbackUrls: artwork ? [`https://coverartarchive.org/release-group/${groupId}/front-500`] : [],
      tracks: (trackPayload.results ?? []).filter((track) => track.wrapperType === "track" && track.trackName).slice(0, 20).map((track) => ({ title: track.trackName ?? title, artist: track.artistName ?? artist, previewUrl: track.previewUrl ?? null, artworkUrl: track.artworkUrl100?.replace(/\d+x\d+bb/, "600x600bb") ?? artwork })),
    };
  } catch {
    return null;
  }
}

export async function getMusicRecordingDetails(recordingId: string): Promise<MusicRecordingDetails | null> {
  if (!/^[0-9a-f-]{36}$/i.test(recordingId)) return null;
  try {
    const response = await musicBrainzFetch(`https://musicbrainz.org/ws/2/recording/${recordingId}?inc=artists+tags&fmt=json`, musicBrainzOptions());
    if (!response.ok) return null;
    const recording = await response.json() as {
      id: string;
      title?: string;
      "first-release-date"?: string;
      disambiguation?: string;
      length?: number;
      "artist-credit"?: { name?: string; artist?: { name?: string } }[];
    };
    const title = recording.title ?? "Music recording";
    const artist = recording["artist-credit"]?.map((credit) => credit.name ?? credit.artist?.name).filter(Boolean).join(", ") ?? "Unknown artist";
    const term = new URLSearchParams({ term: `${artist} ${title}`, entity: "song", limit: "10", country: "US" });
    const lookup = await fetch(`https://itunes.apple.com/search?${term}`, { next: { revalidate: 86_400 }, signal: AbortSignal.timeout(8_000) }).catch(() => null);
    const payload = lookup?.ok ? await lookup.json() as { results?: { trackName?: string; artistName?: string; previewUrl?: string; artworkUrl100?: string }[] } : {};
    const match = (payload.results ?? []).find((entry) => normalizedMusicText(entry.trackName ?? "") === normalizedMusicText(title));
    return {
      id: recordingId,
      title,
      artist,
      firstReleaseDate: recording["first-release-date"] ?? "",
      disambiguation: recording.disambiguation ?? "",
      length: recording.length ?? null,
      artworkUrl: match?.artworkUrl100?.replace(/\d+x\d+bb/, "600x600bb") ?? null,
      previewUrl: match?.previewUrl ?? null,
    };
  } catch {
    return null;
  }
}
