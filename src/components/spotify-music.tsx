"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { Disc3, ExternalLink, LoaderCircle, Music2 } from "lucide-react";
import { MusicTrackList, type PlayableTrack } from "@/components/music-track-list";
import { spotifyAccessToken, refreshSpotifyAccessToken } from "@/lib/spotify-auth";
import { ScrollRail } from "@/components/scroll-rail";
import { useSpotifyConnected } from "@/lib/use-browser-preferences";
import { ArtistHero } from "@/components/artist-hero";
import { ArtistArtwork } from "@/components/artist-artwork";

type SpotifyImage = { url: string; width?: number; height?: number };
type SpotifyArtist = { id: string; name: string; images?: SpotifyImage[]; external_urls?: { spotify?: string } };
type SpotifyAlbum = { id: string; name: string; album_type: string; release_date?: string; total_tracks?: number; artists: SpotifyArtist[]; images?: SpotifyImage[]; external_urls?: { spotify?: string } };
type SpotifyTrack = { id: string; uri: string; name: string; duration_ms?: number; artists: SpotifyArtist[]; album: SpotifyAlbum; external_urls?: { spotify?: string } };
type Page<T> = { items: T[]; next: string | null; total: number };
type SpotifySearch = { artists: Page<SpotifyArtist>; albums: Page<SpotifyAlbum>; tracks: Page<SpotifyTrack> };

async function spotifyJson<T>(path: string): Promise<T> {
  let token = await spotifyAccessToken();
  if (!token) throw new Error("Reconnect Spotify in Settings to continue.");
  const url = path.startsWith("https://api.spotify.com/") ? path : `https://api.spotify.com/v1${path}`;
  let response = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
  if (response.status === 401) {
    token = await refreshSpotifyAccessToken();
    if (token) response = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
  }
  if (!response.ok) {
    if (response.status === 401) throw new Error("Reconnect Spotify in Settings to continue.");
    if (response.status === 403) throw new Error("Spotify denied catalog access (403). Check this app’s allowed users and the owner’s Premium subscription in Spotify’s Developer Dashboard.");
    if (response.status === 429) throw new Error("Spotify is rate limiting requests. Try again shortly.");
    const error = await response.json().catch(() => null) as { error?: { message?: string } } | null;
    throw new Error(error?.error?.message ? `Spotify: ${error.error.message}` : `Spotify catalog is unavailable (${response.status}). Try again shortly.`);
  }
  return response.json() as Promise<T>;
}

function SpotifyCredit() {
  return <span className="inline-flex items-center gap-1.5 text-[10px] text-white/45"><svg aria-hidden="true" viewBox="0 0 24 24" className="size-4"><circle cx="12" cy="12" r="12" fill="#1ed760"/><path d="M17.1 16.7a.75.75 0 0 1-1.03.25c-2.83-1.73-6.4-2.12-10.6-1.16a.75.75 0 1 1-.34-1.46c4.6-1.05 8.54-.6 11.72 1.34.35.21.46.68.25 1.03Zm1.47-3.27a.94.94 0 0 1-1.29.31c-3.24-1.99-8.18-2.56-12.01-1.4a.94.94 0 1 1-.55-1.8c4.38-1.33 9.82-.69 13.55 1.6.44.27.58.85.3 1.29Zm.11-3.43C14.8 7.68 8.4 7.46 4.7 8.58a1.12 1.12 0 1 1-.65-2.14c4.25-1.29 11.32-1.04 15.78 1.61a1.12 1.12 0 0 1-1.15 1.93Z" fill="#07150b"/></svg> Catalog provided by Spotify</span>;
}

function AlbumCard({ album, width = "w-[150px]" }: { album: SpotifyAlbum; width?: string }) {
  const image = album.images?.[0]?.url;
  return <Link href={`/music/albums/${album.id}`} className={`group ${width} shrink-0 snap-start`}>
    <div className="relative aspect-square overflow-hidden rounded-2xl border border-white/10 bg-black/25 shadow-lg shadow-black/20">{image ? <Image src={image} alt={`${album.name} cover`} fill sizes="(max-width: 640px) 150px, 174px" className="object-cover transition duration-300 group-hover:scale-[1.035]" /> : <div className="grid size-full place-items-center text-white/50"><Music2 size={30}/></div>}</div>
    <span className="mt-2 block truncate text-sm font-medium text-white">{album.name}</span>
    <span className="mt-1 block truncate text-xs text-white/60">{album.artists.map((artist) => artist.name).join(", ")} · {album.release_date?.slice(0, 4) ?? ""}</span>
  </Link>;
}

function ArtistCard({ artist }: { artist: SpotifyArtist }) {
  return <Link href={`/music/artists/${artist.id}`} className="group w-[120px] shrink-0 snap-start text-center">
    <div className="relative mx-auto grid aspect-square w-[104px] place-items-center overflow-hidden rounded-full border border-white/10 bg-black/25 shadow-lg"><ArtistArtwork name={artist.name} imageUrl={artist.images?.[0]?.url} sizes="104px"/></div>
    <span className="mt-2 block truncate text-sm font-medium text-white">{artist.name}</span>
  </Link>;
}

function toTrack(track: SpotifyTrack): PlayableTrack {
  return {
    title: track.name,
    artist: track.artists.map((artist) => artist.name).join(", "),
    album: track.album.name,
    year: track.album.release_date?.slice(0, 4),
    artworkUrl: track.album.images?.[0]?.url,
    internalHref: `/music/tracks/${track.id}`,
    spotifyUri: track.uri,
    spotifyUrl: track.external_urls?.spotify ?? `https://open.spotify.com/track/${track.id}`,
  };
}

function appendUnique<T extends { id: string }>(before: T[], after: T[]) {
  const ids = new Set(before.map((item) => item.id));
  return [...before, ...after.filter((item) => !ids.has(item.id))];
}

function mergeSpotifyPage<T extends { id: string }>(before: Page<T>, after: Page<T> | null) {
  return after ? { ...after, items: appendUnique(before.items, after.items) } : before;
}

export function SpotifySearchResults({ query, returnTo, fallback, market = "US" }: { query: string; returnTo: string; fallback: ReactNode; market?: string }) {
  const connected = useSpotifyConnected();
  const [result, setResult] = useState<{ query: string; data: SpotifySearch } | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorState, setErrorState] = useState<{ query: string; message: string } | null>(null);
  const normalizedQuery = query.trim();
  const data = result?.query === normalizedQuery ? result.data : null;
  const error = errorState?.query === normalizedQuery ? errorState.message : "";

  useEffect(() => {
    if (!connected || !normalizedQuery) return;
    let cancelled = false;
    const params = new URLSearchParams({ q: normalizedQuery, type: "artist,album,track", limit: "10", market });
    void spotifyJson<SpotifySearch>(`/search?${params}`).then((result) => {
      if (!cancelled) setResult({ query: normalizedQuery, data: result });
    }).catch((cause: unknown) => {
      if (!cancelled) setErrorState({ query: normalizedQuery, message: cause instanceof Error ? cause.message : "Spotify search failed." });
    });
    return () => { cancelled = true; };
  }, [connected, normalizedQuery, market]);

  async function loadMore() {
    if (!data || loading) return;
    setLoading(true);
    try {
      const [artistPage, albumPage, trackPage] = await Promise.all([
        data.artists.next ? spotifyJson<Page<SpotifyArtist>>(data.artists.next) : Promise.resolve(null),
        data.albums.next ? spotifyJson<Page<SpotifyAlbum>>(data.albums.next) : Promise.resolve(null),
        data.tracks.next ? spotifyJson<Page<SpotifyTrack>>(data.tracks.next) : Promise.resolve(null),
      ]);
      setResult((previous) => {
        if (!previous || previous.query !== normalizedQuery) return previous;
        return { query: normalizedQuery, data: {
          artists: mergeSpotifyPage(previous.data.artists, artistPage),
          albums: mergeSpotifyPage(previous.data.albums, albumPage),
          tracks: mergeSpotifyPage(previous.data.tracks, trackPage),
        } };
      });
    } catch (cause) {
      setErrorState({ query: normalizedQuery, message: cause instanceof Error ? cause.message : "More Spotify results couldn’t load." });
    } finally { setLoading(false); }
  }

  if (!connected) return <>{fallback}</>;
  if (error && !data) return <div className="space-y-6"><p role="status" className="rounded-xl border border-amber-100/15 bg-amber-100/[.04] p-3 text-xs text-amber-100/80">{error}</p>{fallback}</div>;
  const artists = data?.artists.items ?? [];
  const albums = data?.albums.items ?? [];
  const tracks = data?.tracks.items ?? [];
  const topItems = [...artists.slice(0, 1).map((artist) => ({ kind: "artist" as const, data: artist })), ...albums.slice(0, 1).map((album) => ({ kind: "album" as const, data: album })), ...tracks.slice(0, 1).map((track) => ({ kind: "track" as const, data: track }))];
  const hasMore = Boolean(data?.artists.next || data?.albums.next || data?.tracks.next);

  return <div className="mx-auto max-w-[1180px] space-y-8">
    <div className="flex items-center justify-between gap-3"><p className="text-xs text-white/50">Results from Spotify’s catalog. Search is paged by category.</p><SpotifyCredit/></div>
    {error && <p role="status" className="rounded-xl border border-rose-200/15 bg-rose-200/[.05] p-3 text-xs text-rose-100">{error}</p>}
    {!data && !error && <div role="status" className="glass flex min-h-48 items-center justify-center rounded-3xl text-sm text-white/70"><LoaderCircle size={18} className="mr-2 animate-spin"/>Searching Spotify…</div>}
    {data && !topItems.length && !loading && <div className="glass rounded-3xl p-8 text-center"><h3 className="text-lg font-semibold text-white">Nothing matched “{query.trim()}”</h3><p className="mt-2 text-sm text-white/65">Spotify has no matching artist, album, or song in this market.</p></div>}
    {topItems.length > 0 && <section><h2 className="mb-3 text-lg font-semibold text-white">Top results</h2><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {topItems.map((item) => item.kind === "artist" ? <Link key={`top:${item.data.id}`} href={`/music/artists/${item.data.id}`} className="glass flex min-h-24 items-center gap-4 rounded-2xl p-3 transition hover:bg-white/[.1]"><div className="relative size-[68px] shrink-0 overflow-hidden rounded-full border border-white/10 bg-black/25">{item.data.images?.[0]?.url ? <Image src={item.data.images[0].url} alt="" fill sizes="68px" className="object-cover"/> : <div className="grid size-full place-items-center text-white/50"><Disc3/></div>}</div><span><span className="block truncate text-sm font-semibold text-white">{item.data.name}</span><span className="mt-1 block text-xs text-white/60">Artist</span></span></Link> : item.kind === "album" ? <Link key={`top:${item.data.id}`} href={`/music/albums/${item.data.id}`} className="glass flex min-h-24 items-center gap-4 rounded-2xl p-3 transition hover:bg-white/[.1]"><div className="relative size-[68px] shrink-0 overflow-hidden rounded-xl border border-white/10 bg-black/25">{item.data.images?.[0]?.url && <Image src={item.data.images[0].url} alt="" fill sizes="68px" className="object-cover"/>}</div><span className="min-w-0"><span className="block truncate text-sm font-semibold text-white">{item.data.name}</span><span className="mt-1 block truncate text-xs text-white/60">{item.data.artists.map((artist) => artist.name).join(", ")} · Album</span></span></Link> : <Link key={`top:${item.data.id}`} href={`/music/tracks/${item.data.id}`} className="glass flex min-h-24 items-center gap-4 rounded-2xl p-3 transition hover:bg-white/[.1]"><div className="relative size-[68px] shrink-0 overflow-hidden rounded-xl border border-white/10 bg-black/25">{item.data.album.images?.[0]?.url && <Image src={item.data.album.images[0].url} alt="" fill sizes="68px" className="object-cover"/>}</div><span className="min-w-0"><span className="block truncate text-sm font-semibold text-white">{item.data.name}</span><span className="mt-1 block truncate text-xs text-white/60">Song · {item.data.artists.map((artist) => artist.name).join(", ")}</span></span></Link>)}
    </div></section>}
    {artists.length > 0 && <section><h2 className="mb-3 text-lg font-semibold text-white">Artists</h2><ScrollRail label="artists">{artists.map((artist) => <ArtistCard key={artist.id} artist={artist}/>)}</ScrollRail></section>}
    {albums.length > 0 && <section><h2 className="mb-3 text-lg font-semibold text-white">Albums and releases</h2><ScrollRail label="albums and releases">{albums.map((album) => <AlbumCard key={album.id} album={album}/>)}</ScrollRail></section>}
    {tracks.length > 0 && <section><h2 className="mb-3 text-lg font-semibold text-white">Songs</h2><MusicTrackList tracks={tracks.map(toTrack)} returnTo={returnTo}/></section>}
    {data && hasMore && <div className="flex justify-center"><button type="button" disabled={loading} onClick={() => void loadMore()} className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[.07] px-5 py-2.5 text-sm text-white/85 transition hover:bg-white/[.12] disabled:opacity-50">{loading && <LoaderCircle size={15} className="animate-spin"/>}{loading ? "Loading more…" : "Load more Spotify results"}</button></div>}
  </div>;
}

export function SpotifyArtistCatalog({ artistName, spotifyArtistId, returnTo, fallback, additionalReleases }: { artistName: string; spotifyArtistId?: string; returnTo: string; fallback: ReactNode; additionalReleases?: ReactNode }) {
  const connected = useSpotifyConnected();
  const catalogKey = spotifyArtistId || artistName.toLocaleLowerCase();
  const [loading, setLoading] = useState(false);
  const [messageState, setMessageState] = useState<{ key: string; message: string } | null>(null);
  const [catalogState, setCatalogState] = useState<{ key: string; artist: SpotifyArtist; tracks: SpotifyTrack[]; albums: SpotifyAlbum[]; nextAlbums: string | null } | null>(null);
  const currentCatalog = catalogState?.key === catalogKey ? catalogState : null;
  const artist = currentCatalog?.artist ?? null;
  const tracks = currentCatalog?.tracks ?? [];
  const albums = currentCatalog?.albums ?? [];
  const nextAlbums = currentCatalog?.nextAlbums ?? null;
  const message = messageState?.key === catalogKey ? messageState.message : "";

  useEffect(() => {
    if (!connected) return;
    let cancelled = false;
    void (async () => {
      let found: SpotifyArtist | undefined;
      if (spotifyArtistId) found = await spotifyJson<SpotifyArtist>(`/artists/${spotifyArtistId}`);
      else {
        const params = new URLSearchParams({ q: `artist:${artistName}`, type: "artist", limit: "10", market: "US" });
        const search = await spotifyJson<{ artists: Page<SpotifyArtist> }>(`/search?${params}`);
        found = search.artists.items.find((item) => item.name.toLocaleLowerCase() === artistName.toLocaleLowerCase()) ?? search.artists.items[0];
      }
      if (!found) throw new Error("Spotify couldn’t find this artist.");
      const [songs, discography] = await Promise.all([
        // Artist top-tracks was removed from Spotify Development Mode in 2026.
        spotifyJson<{ tracks: Page<SpotifyTrack> }>(`/search?${new URLSearchParams({ q: `artist:${found.name}`, type: "track", limit: "10", market: "US" })}`),
        spotifyJson<Page<SpotifyAlbum>>(`/artists/${found.id}/albums?include_groups=album,single,compilation&limit=50&market=US`),
      ]);
      if (cancelled) return;
      const artistId = found.id;
      const tracks = songs.tracks.items.filter((track, index, list) => track.artists.some((artist) => artist.id === artistId) && list.findIndex((other) => other.name.toLocaleLowerCase() === track.name.toLocaleLowerCase()) === index);
      setCatalogState({ key: catalogKey, artist: found, tracks, albums: discography.items, nextAlbums: discography.next });
      setMessageState((previous) => previous?.key === catalogKey ? null : previous);
    })().catch((cause: unknown) => {
      if (!cancelled) setMessageState({ key: catalogKey, message: cause instanceof Error ? cause.message : "Spotify artist catalog couldn’t load." });
    });
    return () => { cancelled = true; };
  }, [artistName, catalogKey, connected, spotifyArtistId]);

  async function loadMoreAlbums() {
    if (!nextAlbums || loading || !currentCatalog) return;
    setLoading(true);
    try {
      const page = await spotifyJson<Page<SpotifyAlbum>>(nextAlbums);
      setCatalogState((previous) => previous?.key === catalogKey ? { ...previous, albums: appendUnique(previous.albums, page.items), nextAlbums: page.next } : previous);
    } catch (cause) { setMessageState({ key: catalogKey, message: cause instanceof Error ? cause.message : "More releases couldn’t load." }); }
    finally { setLoading(false); }
  }

  if (!connected || message && !artist) return <>{fallback}{connected && message && <p role="status" className="mt-4 text-xs text-white/55">Spotify catalog: {message}</p>}</>;
  if (!artist && !message) return <section role="status" className="glass mt-8 rounded-3xl p-8 text-sm text-white/70"><LoaderCircle size={17} className="mr-2 inline animate-spin"/>Loading {artistName || "artist"} from Spotify…</section>;

  const uniqueAlbums = albums.filter((album, index, list) => list.findIndex((candidate) => {
    const normalize = (value: string) => value.toLocaleLowerCase().replace(/\s*\((deluxe|expanded|remastered|remaster|anniversary|special edition)[^)]*\)/g, "").replace(/\s*[-–:]\s*(deluxe|expanded|remastered|anniversary).*/g, "").trim();
    return normalize(candidate.name) === normalize(album.name) && candidate.album_type === album.album_type;
  }) === index);
  const isDiscListing = (item: SpotifyAlbum) => /\b(?:disc|disk)\s*\d+\b/i.test(item.name);
  const isEp = (item: SpotifyAlbum) => item.album_type === "single" && (item.total_tracks ?? 1) >= 3 && (item.total_tracks ?? 1) <= 6;
  const groups = [
    { label: "Albums", items: uniqueAlbums.filter((item) => item.album_type === "album" && !isDiscListing(item)) },
    { label: "Singles", items: uniqueAlbums.filter((item) => item.album_type === "single" && !isDiscListing(item) && !isEp(item)) },
    { label: "EPs", items: uniqueAlbums.filter((item) => isEp(item) && !isDiscListing(item)) },
    { label: "Discs", items: uniqueAlbums.filter(isDiscListing) },
    { label: "Compilations", items: uniqueAlbums.filter((item) => item.album_type === "compilation") },
  ].filter((group) => group.items.length);

  return <div className="space-y-9">
    {artist && <ArtistHero name={artist.name} imageUrl={artist.images?.[0]?.url} tracks={tracks.map(toTrack)} returnTo={returnTo}/>}
    <div className="flex justify-end"><SpotifyCredit/></div>
    {message && <p role="status" className="text-xs text-amber-100/80">{message}</p>}
    <section><h2 className="mb-4 text-2xl font-semibold text-white">Songs</h2><MusicTrackList tracks={tracks.map(toTrack)} returnTo={returnTo}/></section>
    <section className="space-y-7"><h2 className="text-2xl font-semibold text-white">Discography</h2>
      {groups.map((group) => <section key={group.label}><h3 className="mb-3 text-lg font-medium text-white">{group.label}</h3><ScrollRail label={group.label}>{group.items.map((album) => <AlbumCard key={album.id} album={album} width="w-[158px] sm:w-[174px]"/>)}</ScrollRail></section>)}
      {!groups.length && <p className="glass rounded-2xl p-5 text-sm text-white/70">No Spotify releases are listed for this artist.</p>}
      {nextAlbums && <button type="button" disabled={loading} onClick={() => void loadMoreAlbums()} className="rounded-full border border-white/15 bg-white/[.07] px-4 py-2 text-sm text-white/80 hover:bg-white/[.12] disabled:opacity-50">{loading ? "Loading…" : "Load more releases"}</button>}
    </section>
    {additionalReleases}
    <p className="text-[10px] text-white/40">Artist: {artist?.name} · Catalog provided by Spotify.</p>
  </div>;
}

export function SpotifyAlbumCatalog({ title, artist, returnTo, fallback }: { title: string; artist: string; returnTo: string; fallback: ReactNode }) {
  const connected = useSpotifyConnected();
  const catalogKey = `${artist.toLocaleLowerCase()}\u0000${title.toLocaleLowerCase()}`;
  const [catalogState, setCatalogState] = useState<{ key: string; tracks: SpotifyTrack[] | null; error: string } | null>(null);
  const tracks = catalogState?.key === catalogKey ? catalogState.tracks : null;
  const error = catalogState?.key === catalogKey ? catalogState.error : "";

  useEffect(() => {
    if (!connected) return;
    let cancelled = false;
    const params = new URLSearchParams({ q: `album:${title} artist:${artist}`, type: "album", limit: "10", market: "US" });
    void spotifyJson<{ albums: Page<SpotifyAlbum> }>(`/search?${params}`).then(async ({ albums }) => {
      const normalized = (value: string) => value.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
      const match = albums.items.find((item) => normalized(item.name) === normalized(title) && item.artists.some((entry) => normalized(entry.name) === normalized(artist))) ?? albums.items.find((item) => normalized(item.name).includes(normalized(title)));
      if (!match) throw new Error("Spotify doesn’t list this album in this market.");
      const page = await spotifyJson<Page<SpotifyTrack>>(`/albums/${match.id}/tracks?limit=50&market=US`);
      if (cancelled) return;
      const enriched = page.items.map((track) => ({ ...track, album: match }));
      setCatalogState({ key: catalogKey, tracks: enriched, error: "" });
    }).catch((cause: unknown) => { if (!cancelled) setCatalogState({ key: catalogKey, tracks: null, error: cause instanceof Error ? cause.message : "Spotify couldn’t load this album." }); });
    return () => { cancelled = true; };
  }, [artist, catalogKey, connected, title]);

  if (!connected) return <>{fallback}</>;
  if (!tracks && !error) return <section role="status" className="mt-10"><h2 className="mb-4 text-xl font-semibold text-white">Songs</h2><div className="glass rounded-2xl p-5 text-sm text-white/70"><LoaderCircle size={16} className="mr-2 inline animate-spin"/>Loading album from Spotify…</div></section>;
  if (error || !tracks) return <><p role="status" className="mt-8 text-xs text-white/55">Spotify catalog: {error || "Track listings are unavailable."}</p>{fallback}</>;
  return <section className="mt-10"><div className="mb-4 flex items-end justify-between gap-3"><div><h2 className="text-xl font-semibold text-white">Songs</h2><p className="mt-1 text-sm text-white/60">Full-track playback from Spotify.</p></div><SpotifyCredit/></div><MusicTrackList tracks={tracks.map(toTrack)} returnTo={returnTo}/></section>;
}

export function SpotifyAlbumProfile({ spotifyAlbumId }: { spotifyAlbumId: string }) {
  const connected = useSpotifyConnected();
  const [albumState, setAlbumState] = useState<{ id: string; album: SpotifyAlbum; tracks: SpotifyTrack[] } | null>(null);
  const [errorState, setErrorState] = useState<{ id: string; message: string } | null>(null);
  const album = albumState?.id === spotifyAlbumId ? albumState.album : null;
  const tracks = albumState?.id === spotifyAlbumId ? albumState.tracks : [];
  const error = errorState?.id === spotifyAlbumId ? errorState.message : "";

  useEffect(() => {
    if (!connected) return;
    let cancelled = false;
    void (async () => {
      const [albumData, page] = await Promise.all([
        spotifyJson<SpotifyAlbum>(`/albums/${spotifyAlbumId}?market=US`),
        spotifyJson<Page<Omit<SpotifyTrack, "album">>>(`/albums/${spotifyAlbumId}/tracks?limit=50&market=US`),
      ]);
      if (cancelled) return;
      setAlbumState({ id: spotifyAlbumId, album: albumData, tracks: page.items.map((track) => ({ ...track, album: albumData })) });
    })().catch((cause: unknown) => {
      if (!cancelled) setErrorState({ id: spotifyAlbumId, message: cause instanceof Error ? cause.message : "Spotify couldn’t load this album." });
    });
    return () => { cancelled = true; };
  }, [connected, spotifyAlbumId]);

  if (!connected) return <div className="glass rounded-3xl p-6 text-sm leading-6 text-white/75"><h1 className="text-2xl font-semibold text-white">Connect Spotify to view this album</h1><p className="mt-2">The album page stays in Horizon. Connect your account in Settings to load its songs and play them here.</p><Link href="/settings" className="mt-4 inline-flex rounded-full border border-white/15 px-4 py-2 text-white hover:bg-white/10">Open Settings</Link></div>;
  if (!album && !error) return <div role="status" className="glass rounded-3xl p-6 text-sm text-white/70"><LoaderCircle size={17} className="mr-2 inline animate-spin"/>Loading album…</div>;
  if (!album) return <div role="status" className="glass rounded-3xl p-6 text-sm text-rose-100">{error || "This album isn’t available in Spotify’s catalog."}</div>;

  return <div className="space-y-8">
    <header className="glass flex flex-col gap-5 rounded-3xl p-5 sm:flex-row sm:items-end sm:p-8">
      <div className="relative size-44 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-black/25 sm:size-56">{album.images?.[0]?.url && <Image src={album.images[0].url} alt={`${album.name} cover`} fill sizes="(max-width: 640px) 176px, 224px" className="object-cover"/>}</div>
      <div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-[.2em] text-white/55">{album.album_type === "single" ? ((album.total_tracks ?? 1) >= 3 && (album.total_tracks ?? 1) <= 6 ? "EP / multi-track single" : "Single") : album.album_type === "compilation" ? "Compilation" : "Album"}</p><h1 className="mt-2 text-3xl font-semibold text-white sm:text-5xl">{album.name}</h1><p className="mt-2 flex flex-wrap items-center gap-x-1 text-sm text-white/70">{album.artists.map((artist, index) => <span key={artist.id}><Link href={`/music/artists/${artist.id}`} className="hover:text-white hover:underline">{artist.name}</Link>{index < album.artists.length - 1 ? ", " : ""}</span>)}<span>· {album.release_date?.slice(0, 4) ?? ""}</span></p><div className="mt-4"><SpotifyCredit/></div></div>
    </header>
    {error && <p role="status" className="text-sm text-amber-100/80">{error}</p>}
    <section><div className="mb-3"><h2 className="text-xl font-semibold text-white">Songs</h2><p className="mt-1 text-sm text-white/60">{tracks.length} tracks · Play through your connected Spotify account.</p></div><MusicTrackList tracks={tracks.map(toTrack)} returnTo={`/music/albums/${spotifyAlbumId}`}/></section>
  </div>;
}

type LyricLine = { text: string; timeMs?: number };
type LyricsResponse = { configured: boolean; lines: LyricLine[]; copyright?: string; attributionUrl?: string; message?: string };

export function SpotifyTrackLyricsPage({ spotifyTrackId }: { spotifyTrackId: string }) {
  const connected = useSpotifyConnected();
  const [trackState, setTrackState] = useState<{ id: string; track: SpotifyTrack } | null>(null);
  const [lyricState, setLyricState] = useState<{ id: string; lines: LyricLine[]; copyright: string; attributionUrl: string; configured: boolean } | null>(null);
  const [errorState, setErrorState] = useState<{ id: string; message: string } | null>(null);
  const track = trackState?.id === spotifyTrackId ? trackState.track : null;
  const lines = lyricState?.id === spotifyTrackId ? lyricState.lines : [];
  const copyright = lyricState?.id === spotifyTrackId ? lyricState.copyright : "";
  const attributionUrl = lyricState?.id === spotifyTrackId ? lyricState.attributionUrl : "https://www.musixmatch.com/";
  const lyricsConfigured = lyricState?.id === spotifyTrackId ? lyricState.configured : true;
  const error = errorState?.id === spotifyTrackId ? errorState.message : "";
  const [positionMs, setPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);

  useEffect(() => {
    if (!connected) return;
    let cancelled = false;
    void spotifyJson<SpotifyTrack>(`/tracks/${spotifyTrackId}?market=US`).then(async (song) => {
      if (cancelled) return;
      setTrackState({ id: spotifyTrackId, track: song });
      setDurationMs(song.duration_ms ?? 0);
      const query = new URLSearchParams({ title: song.name, artist: song.artists.map((artist) => artist.name).join(", "), duration: String(Math.round((song.duration_ms ?? 0) / 1000)) });
      const response = await fetch(`/api/lyrics?${query}`);
      const result = await response.json() as LyricsResponse;
      if (!response.ok) throw new Error(result.message || "Lyrics could not be loaded.");
      if (!cancelled) {
        setLyricState({ id: spotifyTrackId, lines: result.lines ?? [], copyright: result.copyright ?? "", attributionUrl: result.attributionUrl ?? "https://www.musixmatch.com/", configured: result.configured });
        if (result.message) setErrorState({ id: spotifyTrackId, message: result.message });
      }
    }).catch((cause: unknown) => {
      if (!cancelled) setErrorState({ id: spotifyTrackId, message: cause instanceof Error ? cause.message : "Spotify couldn’t load this song." });
    });
    return () => { cancelled = true; };
  }, [connected, spotifyTrackId]);

  useEffect(() => {
    const receive = (event: Event) => {
      const detail = (event as CustomEvent<{ trackId?: string; positionMs?: number; durationMs?: number }>).detail;
      if (detail?.trackId === spotifyTrackId) {
        setPositionMs(detail.positionMs ?? 0);
        setDurationMs(detail.durationMs ?? 0);
      }
    };
    window.addEventListener("horizon:spotify-state", receive);
    window.dispatchEvent(new Event("horizon:spotify-request-state"));
    return () => window.removeEventListener("horizon:spotify-state", receive);
  }, [spotifyTrackId]);

  if (!connected) return <div className="glass rounded-3xl p-6 text-sm leading-6 text-white/75"><h1 className="text-2xl font-semibold text-white">Connect Spotify to open this song</h1><p className="mt-2">Connect your account in Settings to load the song and play it in Horizon.</p><Link href="/settings" className="mt-4 inline-flex rounded-full border border-white/15 px-4 py-2 text-white hover:bg-white/10">Open Settings</Link></div>;
  if (!track && !error) return <div role="status" className="glass rounded-3xl p-6 text-sm text-white/70"><LoaderCircle size={17} className="mr-2 inline animate-spin"/>Loading song…</div>;
  if (!track) return <p role="status" className="glass rounded-3xl p-6 text-sm text-rose-100">{error || "This song isn’t available in Spotify’s catalog."}</p>;

  const activeLine = lines.reduce((active, line, index) => line.timeMs !== undefined && line.timeMs <= positionMs ? index : active, -1);
  const artwork = track.album.images?.[0]?.url;
  return <div className="relative isolate min-h-[calc(100vh-10rem)] overflow-hidden rounded-3xl border border-white/10 bg-slate-950/45 p-5 sm:p-8 lg:p-12">
    <div aria-hidden="true" className="lyrics-ambient absolute inset-0 -z-10" style={artwork ? { backgroundImage: `linear-gradient(110deg, rgba(3,7,18,.84), rgba(3,7,18,.58)), url("${artwork}")` } : undefined}/>
    <div className="mb-8 flex items-center justify-between gap-3"><Link href={`/music/albums/${track.album.id}`} className="text-sm text-white/70 hover:text-white">← {track.album.name}</Link><Link href="/discover?type=MUSIC" className="text-sm text-white/70 hover:text-white">Back to Music</Link></div>
    <div className="grid gap-10 lg:grid-cols-[minmax(250px,380px)_minmax(0,1fr)] lg:gap-16">
      <section className="lg:sticky lg:top-10 lg:self-start">
        <div className="relative mx-auto aspect-square w-full max-w-[380px] overflow-hidden rounded-2xl border border-white/15 shadow-2xl shadow-black/40">{artwork && <Image src={artwork} alt={`${track.album.name} cover`} fill sizes="(max-width: 1024px) 100vw, 380px" className="object-cover"/>}</div>
        <div className="mx-auto mt-5 max-w-[380px]"><p className="text-xs font-semibold uppercase tracking-[.2em] text-white/55">Now playing</p><h1 className="mt-2 text-2xl font-semibold text-white">{track.name}</h1><p className="mt-1 text-white/70">{track.artists.map((artist) => artist.name).join(", ")} · {track.album.name}</p><div className="mt-4"><MusicTrackList tracks={[toTrack(track)]} returnTo={`/music/tracks/${spotifyTrackId}`}/></div></div>
      </section>
      <section aria-label="Lyrics" className="min-h-[50vh] py-1 sm:py-5">
        <h2 className="text-xs font-semibold uppercase tracking-[.24em] text-white/55">Lyrics</h2>
        {(!lyricState || lyricState.id !== spotifyTrackId) && !error ? <div role="status" className="mt-8 text-sm text-white/70"><LoaderCircle size={16} className="mr-2 inline animate-spin"/>Finding licensed lyrics…</div>
          : lines.length ? <div className="mt-8 space-y-5 pb-8">{lines.map((line, index) => <p key={`${line.timeMs ?? "plain"}:${index}`} className={`lyrics-line text-2xl font-semibold leading-tight transition-all duration-700 sm:text-3xl lg:text-4xl ${activeLine === index ? "text-white opacity-100" : "text-white/40"}`} style={{ animationDelay: `${Math.min(index * 45, 1200)}ms` }}>{line.text}</p>)}</div>
          : <div className="glass mt-6 rounded-2xl p-5 text-sm leading-6 text-white/75"><p className="font-medium text-white">{lyricsConfigured ? "Lyrics aren’t available for this track." : "A licensed lyrics source is needed to show lyrics."}</p><p className="mt-2">Horizon is ready to display time-synced lyrics from Musixmatch. Configure a Musixmatch API key on the server to enable licensed lyrics.</p><a href="https://developer.musixmatch.com/" target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center text-white underline underline-offset-4">Musixmatch developer access <ExternalLink size={12} className="ml-1"/></a>{error && <p className="mt-3 text-xs text-amber-100/80">{error}</p>}</div>}
        {copyright && <p className="mt-8 text-xs leading-5 text-white/45">{copyright} · <a href={attributionUrl} target="_blank" rel="noreferrer" className="underline underline-offset-2">Musixmatch</a></p>}
      </section>
    </div>
    {durationMs > 0 && <span className="sr-only">Playback position: {Math.floor(positionMs / 1000)} of {Math.floor(durationMs / 1000)} seconds</span>}
  </div>;
}
