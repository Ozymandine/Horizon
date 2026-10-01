import "server-only";
import type { RadarItem } from "@/lib/radar";

export type AppleEntry = { wrapperType?: string; kind?: string; artistId?: number; artistName?: string; collectionId?: number; collectionName?: string; trackId?: number; trackName?: string; releaseDate?: string; artworkUrl100?: string; primaryGenreName?: string; trackCount?: number; trackTimeMillis?: number; trackNumber?: number; collectionViewUrl?: string; trackViewUrl?: string; artistLinkUrl?: string; copyright?: string; country?: string };
export function appleItem(entry: AppleEntry): RadarItem {
  const artist = entry.wrapperType === "artist";
  const song = entry.kind === "song";
  const id = String(artist ? entry.artistId : song ? entry.trackId : entry.collectionId);
  const kind = artist ? "artist" : song ? "song" : "album";
  const title = artist ? entry.artistName ?? "Artist" : song ? entry.trackName ?? "Song" : entry.collectionName ?? "Album";
  const date = entry.releaseDate?.slice(0, 10) ?? null;
  const artwork = entry.artworkUrl100?.replace(/\d+x\d+bb/, "600x600bb") ?? null;
  return { source: `apple-${kind}`, sourceId: id, type: "MUSIC", title, artistName: entry.artistName, displayDate: `${kind === "artist" ? "Artist" : kind === "song" ? "Song" : "Album"}${date ? ` · ${date.slice(0, 4)}` : ""}`, releaseDate: date, sortTimestamp: date, isApproximate: !date, posterUrl: artwork, backdropUrl: artwork, description: artist ? `Explore music by ${title}.` : `${kind === "song" ? "A song" : "An album"} by ${entry.artistName ?? "an artist"}${entry.primaryGenreName ? ` · ${entry.primaryGenreName}` : ""}.`, tags: entry.primaryGenreName ? [entry.primaryGenreName] : [], externalUrl: entry.collectionViewUrl ?? entry.trackViewUrl ?? entry.artistLinkUrl ?? null, tmdbId: null, genreIds: [], popularity: 0, href: `/music/catalog/${kind}/${id}` };
}
export async function appleLookup(id: string, entity = "song", country = "US"): Promise<AppleEntry[]> {
  if (!/^\d{1,16}$/.test(id)) return [];
  const response = await fetch(`https://itunes.apple.com/lookup?${new URLSearchParams({ id, entity, country, limit: "100" })}`, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error("Music details are temporarily unavailable.");
  return ((await response.json()) as { results?: AppleEntry[] }).results ?? [];
}
export async function searchMusicCatalog(query: string, country: string): Promise<RadarItem[]> {
  const response = await fetch(`https://itunes.apple.com/search?${new URLSearchParams({ term: query, media: "music", entity: "album,musicArtist,song", country, limit: "100" })}`, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error("Music search is temporarily unavailable.");
  const entries = ((await response.json()) as { results?: AppleEntry[] }).results ?? [];
  const unique = new Map<string, RadarItem>();
  for (const entry of entries) {
    if (!entry.artistId && !entry.collectionId && !entry.trackId) continue;
    const item = appleItem(entry);
    unique.set(`${item.source}:${item.sourceId}`, item);
  }
  const items = [...unique.values()];
  const groups = [items.filter((item) => item.source === "apple-artist"), items.filter((item) => item.source === "apple-album"), items.filter((item) => item.source === "apple-song")];
  // Mix all three kinds into the first page instead of burying albums behind songs.
  return Array.from({ length: Math.max(...groups.map((group) => group.length), 0) }, (_, index) => groups.flatMap((group) => group[index] ? [group[index]] : [])).flat();
}
type ChartEntry = { id?: { attributes?: { "im:id"?: string }; label?: string }; "im:name"?: { label?: string }; "im:artist"?: { label?: string; attributes?: { href?: string } }; "im:image"?: { label: string }[]; "im:releaseDate"?: { label?: string }; category?: { attributes?: { label?: string } } };
const genreIds: Record<string, string> = { "tag:pop": "14", "tag:rock": "21", "tag:hip hop": "18", "tag:r&b": "15", "tag:country": "6" };
export async function musicChart(sort: string, genre: string, country: string): Promise<RadarItem[]> {
  const songs = sort === "songs" || sort === "artists";
  const url = `https://itunes.apple.com/${country.toLowerCase()}/rss/${songs ? "topsongs" : "topalbums"}/limit=100${genreIds[genre] ? `/genre=${genreIds[genre]}` : ""}/json`;
  const response = await fetch(url, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error("Music charts are temporarily unavailable.");
  const entries = ((await response.json()) as { feed?: { entry?: ChartEntry[] } }).feed?.entry ?? [];
  const unique = new Map<string, RadarItem>();
  entries.forEach((entry, index) => {
    const id = Number(entry.id?.attributes?.["im:id"]);
    if (!id) return;
    const artistId = Number(entry["im:artist"]?.attributes?.href?.match(/\/(?:id)?(\d+)(?:\?|$)/)?.[1]);
    if (sort === "artists" && !artistId) return;
    const item = appleItem({ wrapperType: sort === "artists" ? "artist" : "collection", kind: songs && sort !== "artists" ? "song" : undefined, collectionId: id, trackId: id, artistId, collectionName: entry["im:name"]?.label, trackName: entry["im:name"]?.label, artistName: entry["im:artist"]?.label, artworkUrl100: entry["im:image"]?.at(-1)?.label, releaseDate: entry["im:releaseDate"]?.label, primaryGenreName: entry.category?.attributes?.label, collectionViewUrl: entry.id?.label });
    item.popularity = 100 - index;
    // Artist rows use credited release artwork, never label it as an artist portrait.
    if (!unique.has(`${item.source}:${item.sourceId}`)) unique.set(`${item.source}:${item.sourceId}`, item);
  });
  return [...unique.values()];
}
