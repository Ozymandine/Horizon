import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Disc3 } from "lucide-react";
import { appleItem, appleLookup, type AppleEntry } from "@/lib/music-catalog";
import { MusicTrackList, type PlayableTrack } from "@/components/music-track-list";
import { SpotifyAlbumCatalog, SpotifyArtistCatalog } from "@/components/spotify-music";
import { AddToMyListMenu } from "@/components/add-to-my-list-menu";
import { AddToTimelineButton } from "@/components/add-to-timeline-button";
import { safeReturnTo, returnLabel } from "@/lib/return-to";
import { countries } from "@/lib/discovery-options";
import { artistPortrait } from "@/lib/artist-artwork";
import { ArtistHero } from "@/components/artist-hero";
import { ScrollRail } from "@/components/scroll-rail";

function playable(entry: AppleEntry): PlayableTrack {
  return {
    title: entry.trackName ?? "Song", artist: entry.artistName, album: entry.collectionName,
    artworkUrl: entry.artworkUrl100?.replace(/\d+x\d+bb/, "600x600bb"),
    year: entry.releaseDate?.slice(0, 4), internalHref: entry.trackId ? `/music/catalog/song/${entry.trackId}` : undefined,
  };
}

export default async function MusicCatalogPage({ params, searchParams }: {
  params: Promise<{ kind: string; id: string }>;
  searchParams: Promise<{ returnTo?: string; country?: string }>;
}) {
  const { kind, id } = await params;
  if (!["song", "album", "artist"].includes(kind) || !/^\d{1,16}$/.test(id)) notFound();
  const search = await searchParams;
  const backTo = search.returnTo ? safeReturnTo(search.returnTo) : "/discover?type=MUSIC";
  const selectedCountry = search.country ?? new URL(backTo, "https://horizon.invalid").searchParams.get("country");
  const country = countries.some((entry) => entry.value === selectedCountry) ? selectedCountry! : "US";
  const currentPath = `/music/catalog/${kind}/${id}${country !== "US" ? `?country=${country}` : ""}`;
  const drilldown = (targetKind: string, targetId: string | number) => `/music/catalog/${targetKind}/${targetId}?${new URLSearchParams({ returnTo: currentPath, ...(country !== "US" ? { country } : {}) })}`;
  let entries: AppleEntry[];
  let artistSongs: AppleEntry[] = [];
  let portrait: string | null = null;
  try {
    [entries, artistSongs, portrait] = await Promise.all([
      appleLookup(id, kind === "artist" ? "album" : "song", country),
      kind === "artist" ? appleLookup(id, "song", country).catch(() => []) : Promise.resolve([]),
      kind === "artist" ? artistPortrait(id, country) : Promise.resolve(null),
    ]);
  }
  catch {
    return <main className="mx-auto min-h-screen max-w-5xl px-6 pb-40 pt-10"><Link href={backTo} className="inline-flex items-center gap-2 text-sm text-white/65"><ArrowLeft size={16}/>{returnLabel(backTo)}</Link><div className="glass mt-8 rounded-3xl p-8"><h1 className="text-2xl font-semibold">Music details couldn’t load</h1><p className="mt-3 text-white/60">Please try this page again in a moment.</p><a href={currentPath} className="detail-action mt-6">Try again</a></div></main>;
  }
  const primary = kind === "artist" ? entries.find((entry) => entry.wrapperType === "artist") : kind === "song" ? entries.find((entry) => String(entry.trackId) === id) : entries.find((entry) => String(entry.collectionId) === id && entry.wrapperType === "collection");
  if (!primary) notFound();
  const item = appleItem(primary);
  const tracks = entries.filter((entry) => entry.kind === "song" && entry.trackName);
  const albums = entries.filter((entry, index, list) => entry.wrapperType === "collection" && entry.collectionId && list.findIndex((other) => other.wrapperType === "collection" && other.collectionName?.toLocaleLowerCase() === entry.collectionName?.toLocaleLowerCase()) === index);
  const artwork = kind === "artist" ? portrait : item.posterUrl;
  const artistHref = primary.artistId ? drilldown("artist", primary.artistId) : null;
  const songs = artistSongs.filter((entry, index, list) => entry.kind === "song" && entry.trackId && entry.artistId === primary.artistId && list.findIndex((other) => other.kind === "song" && other.artistId === entry.artistId && other.trackName?.toLocaleLowerCase() === entry.trackName?.toLocaleLowerCase()) === index).slice(0, 10).map((entry) => ({ ...playable(entry), internalHref: `${playable(entry).internalHref}${country !== "US" ? `?country=${country}` : ""}` }));
  const latest = [...albums].sort((a, b) => (b.releaseDate ?? "").localeCompare(a.releaseDate ?? ""))[0];
  const singles = (album: AppleEntry) => /(?:\bEP\b|\bSingle\b)/i.test(album.collectionName ?? "") || (album.trackCount ?? 10) <= 6;
  const live = (album: AppleEntry) => /\bLive\b/i.test(album.collectionName ?? "");
  const albumGroups = [
    { label: "Albums", entries: albums.filter((album) => !singles(album) && !live(album)) },
    { label: "Singles & EPs", entries: albums.filter((album) => singles(album) && !live(album)) },
    { label: "Live releases", entries: albums.filter(live) },
  ].filter((group) => group.entries.length);
  const fallbackArtist = <div className="artist-catalog space-y-10">
    <ArtistHero name={item.title} imageUrl={portrait} genre={primary.primaryGenreName} tracks={songs} returnTo={currentPath}/>
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(260px,.45fr)]">
      {songs.length > 0 && <section><h2 className="mb-4 text-2xl font-semibold">Top songs</h2><MusicTrackList tracks={songs.slice(0, 6)} returnTo={currentPath}/></section>}
      {latest && <section><h2 className="mb-4 text-2xl font-semibold">Latest release</h2><Link href={drilldown("album", latest.collectionId!)} className="artist-latest"><div className="relative aspect-square w-full max-w-64 overflow-hidden rounded-xl bg-white/[.06]">{latest.artworkUrl100 && <Image src={latest.artworkUrl100.replace(/\d+x\d+bb/, "600x600bb")} alt="" fill sizes="256px" className="object-cover"/>}</div><div><p className="text-xs text-white/50">{latest.releaseDate?.slice(0, 4)}</p><h3 className="mt-2 text-lg font-semibold">{latest.collectionName}</h3><p className="mt-2 text-sm text-white/55">{latest.trackCount} songs</p></div></Link></section>}
    </div>
    {albumGroups.map((group) => <section key={group.label}><h2 className="mb-4 text-2xl font-semibold">{group.label}</h2><ScrollRail label={group.label}>{group.entries.map((album) => <Link key={album.collectionId} href={drilldown("album", album.collectionId!)} className="group w-[174px] shrink-0 snap-start sm:w-[210px]"><div className="relative aspect-square overflow-hidden rounded-xl bg-white/[.06]">{album.artworkUrl100 && <Image src={album.artworkUrl100.replace(/\d+x\d+bb/, "600x600bb")} alt="" fill sizes="210px" className="object-cover transition-transform duration-300 group-hover:scale-[1.035]"/>}</div><h3 className="mt-3 truncate text-sm font-medium">{album.collectionName}</h3><p className="mt-1 text-xs text-white/50">{album.releaseDate?.slice(0, 4)}</p></Link>)}</ScrollRail></section>)}
    {!albums.length && <p className="text-white/60">No releases are listed for this artist in this region.</p>}
  </div>;

  return <main className="relative min-h-screen overflow-hidden pb-40">
    {artwork && <div className="pointer-events-none absolute inset-x-0 top-0 h-[700px] bg-cover bg-center opacity-20 blur-[90px]" style={{ backgroundImage: `url("${artwork}")` }} aria-hidden="true"/>}
    <div className="relative mx-auto max-w-[1400px] px-5 pt-8 sm:px-8 lg:px-12">
      <Link href={backTo} className="mb-8 inline-flex items-center gap-2 text-sm text-white/65 transition hover:text-white"><ArrowLeft size={16}/>{returnLabel(backTo)}</Link>
      {kind === "artist" ? <SpotifyArtistCatalog artistName={item.title} returnTo={currentPath} fallback={fallbackArtist}/> : <>
        <header className="flex flex-col gap-8 sm:flex-row sm:items-end">
          <div className="relative aspect-square w-full max-w-80 shrink-0 overflow-hidden rounded-3xl bg-white/[.06] shadow-2xl shadow-black/35">{artwork ? <Image src={artwork} alt={`${item.title} cover`} fill priority sizes="320px" className="object-cover"/> : <div className="grid size-full place-items-center text-white/40"><Disc3 size={64}/></div>}</div>
          <div className="min-w-0 pb-2"><p className="text-xs font-semibold uppercase tracking-[.2em] text-white/50">{kind}</p><h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">{item.title}</h1><p className="mt-4 text-xl text-white/80">{artistHref ? <Link href={artistHref} className="hover:underline">{primary.artistName}</Link> : primary.artistName}</p><p className="mt-3 text-sm text-white/55">{[primary.primaryGenreName, primary.releaseDate?.slice(0, 4), kind === "album" && primary.trackCount ? `${primary.trackCount} songs` : "", kind === "song" && primary.trackTimeMillis ? `${Math.floor(primary.trackTimeMillis / 60000)}:${String(Math.floor(primary.trackTimeMillis / 1000) % 60).padStart(2, "0")}` : ""].filter(Boolean).join(" · ")}</p><div className="mt-6 flex flex-wrap gap-3"><AddToTimelineButton item={item}/><AddToMyListMenu item={item}/></div></div>
        </header>
        {kind === "album" ? <SpotifyAlbumCatalog title={item.title} artist={primary.artistName ?? ""} returnTo={currentPath} fallback={<section className="mt-10"><h2 className="mb-5 text-2xl font-semibold">Songs</h2><MusicTrackList tracks={tracks.map(playable)} returnTo={currentPath}/></section>}/> : <section className="mt-10 max-w-3xl"><MusicTrackList tracks={[playable(primary)]} returnTo={currentPath}/>{primary.collectionId && <Link href={drilldown("album", primary.collectionId)} className="mt-6 inline-flex text-sm text-white/60 hover:text-white">View {primary.collectionName ?? "album"} →</Link>}</section>}
      </>}
      {primary.copyright && <p className="mt-10 text-xs text-white/40">{primary.copyright}</p>}
    </div>
  </main>;
}
