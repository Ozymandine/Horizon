import Link from "next/link";
import { notFound } from "next/navigation";
import { ScrollRail } from "@/components/scroll-rail";
import { MusicTrackList } from "@/components/music-track-list";
import { SpotifyArtistCatalog } from "@/components/spotify-music";
import { MediaArtwork } from "@/components/media-artwork";
import { getMusicArtistDetails, type RadarItem } from "@/lib/radar";
import { returnLabel, safeReturnTo } from "@/lib/return-to";
import { ArtistHero } from "@/components/artist-hero";

function eventDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("en-US", { dateStyle: "medium", timeStyle: value.includes("T") ? "short" : undefined });
}

function discographyDate(item: RadarItem) {
  if (item.displayDate !== "Release date not listed") return item.displayDate;
  return "Date not listed";
}

export default async function ArtistPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ returnTo?: string }> }) {
  const { id } = await params;
  const backTo = safeReturnTo((await searchParams).returnTo);
  const artist = await getMusicArtistDetails(id);
  if (!artist) notFound();

  const datedAlbums = artist.albums.filter((album) => album.sortTimestamp);
  const undatedAlbums = artist.albums.filter((album) => !album.sortTimestamp);
  const releaseFormat = (album: RadarItem) => {
    const tags = (album.tags ?? []).map((tag) => tag.toLocaleLowerCase());
    if (/\b(?:disc|disk)\s*\d+\b/i.test(album.title) || tags.some((tag) => /\b(?:disc|disk)\b/.test(tag))) return "Discs";
    if (tags.includes("single")) return "Singles";
    if (tags.includes("ep")) return "EPs";
    return tags.includes("album") ? "Albums" : "Other releases";
  };
  const categories = [
    ...["Albums", "Singles", "EPs", "Discs", "Other releases"].map((label) => ({ label, items: datedAlbums.filter((album) => releaseFormat(album) === label) })),
  ].filter((category) => category.items.length > 0);
  const undatedCategories = ["Albums", "Singles", "EPs", "Discs", "Other releases"].map((label) => ({
    label,
    items: undatedAlbums.filter((album) => releaseFormat(album) === label),
  })).filter((category) => category.items.length > 0);
  const undatedReleases = undatedCategories.length > 0 ? <section className="mt-10 space-y-4">
    <div><h2 className="text-2xl font-semibold text-white">Unreleased or date not listed</h2><p className="mt-1 max-w-3xl text-sm leading-6 text-white/65">The catalog has no first-release date for these entries, so it cannot confirm whether they are unreleased.</p></div>
    {undatedCategories.map((category) => <section key={`undated-${category.label}`}>
      <h3 className="mb-3 text-lg font-medium text-white">{category.label}</h3>
      <ScrollRail label={category.label}>
        {category.items.map((album) => <Link key={album.sourceId} href={`${album.href}?returnTo=${encodeURIComponent(`/artists/${artist.id}`)}`} className="group w-[158px] shrink-0 snap-start sm:w-[174px]">
          <div className="relative aspect-square overflow-hidden rounded-2xl border border-white/10 bg-black/30 shadow-lg shadow-black/20"><MediaArtwork title={album.title} type="MUSIC" imageUrl={album.posterUrl} fallbackUrls={album.posterFallbackUrls} className="transition duration-300 group-hover:scale-[1.035]" /></div>
          <h4 className="mt-2 line-clamp-1 text-sm font-medium text-white">{album.title}</h4><p className="mt-1 line-clamp-1 text-xs text-white/65">Date not listed</p>
        </Link>)}
      </ScrollRail>
    </section>)}
  </section> : null;

  return <main className="min-h-screen px-5 pb-32 pt-5 sm:px-8 sm:pt-8" style={artist.portraitUrl ? { backgroundImage: `linear-gradient(180deg, rgba(5, 8, 17, .78), rgba(5, 9, 16, .94) 48%, rgba(5, 9, 16, .98)), url("${artist.portraitUrl}")`, backgroundAttachment: "fixed", backgroundPosition: "center top", backgroundSize: "cover" } : undefined}>
    <div className="mx-auto max-w-[1400px]">
      <Link href={backTo} className="inline-flex items-center gap-2 text-sm text-white/80 transition hover:text-white">← {returnLabel(backTo)}</Link>
      <div className="mt-6"><SpotifyArtistCatalog artistName={artist.name} returnTo={`/artists/${artist.id}`} additionalReleases={undatedReleases} fallback={<>
      <ArtistHero name={artist.name} imageUrl={artist.portraitUrl} genre={artist.disambiguation} tracks={artist.tracks.slice(0, 9)} returnTo={`/artists/${artist.id}`}/>
      <section className="mt-8">
        <h2 className="mb-4 text-2xl font-semibold text-white">Songs</h2>
        <MusicTrackList tracks={artist.tracks.slice(0, 9)} returnTo={`/artists/${artist.id}`} />
      </section>

      <section className="mt-10 space-y-8">
        <div className="flex items-end justify-between"><div><h2 className="text-2xl font-semibold text-white">Discography</h2><p className="mt-1 text-sm text-white/65">Albums, singles, EPs, and discs from the music catalog.</p></div></div>
        {categories.map((category) => <section key={category.label}>
          <h3 className="mb-3 text-lg font-medium text-white">{category.label}</h3>
          <ScrollRail label={category.label}>
            {category.items.map((album) => <Link key={album.sourceId} href={`${album.href}?returnTo=${encodeURIComponent(`/artists/${artist.id}`)}`} className="group w-[158px] shrink-0 snap-start sm:w-[174px]">
              <div className="relative aspect-square overflow-hidden rounded-2xl border border-white/10 bg-black/30 shadow-lg shadow-black/20"><MediaArtwork title={album.title} type="MUSIC" imageUrl={album.posterUrl} fallbackUrls={album.posterFallbackUrls} className="transition duration-300 group-hover:scale-[1.035]" /></div>
              <h4 className="mt-2 line-clamp-1 text-sm font-medium text-white">{album.title}</h4><p className="mt-1 line-clamp-1 text-xs text-white/65">{discographyDate(album)}</p>
            </Link>)}
          </ScrollRail>
        </section>)}
        {undatedReleases}
        {!artist.albums.length && <p className="glass rounded-2xl p-5 text-sm text-white/70">No cataloged releases are available for this artist yet.</p>}
      </section>
      </>} /></div>

      <section className="mt-10">
        <div className="mb-4"><h2 className="text-2xl font-semibold text-white">Upcoming concerts</h2><p className="mt-1 text-sm text-white/65">Live dates and venues for {artist.name}.</p></div>
        {artist.concerts.length ? <><p className="mb-3 text-xs text-white/45">Concert listings via Ticketmaster.</p><div className="grid gap-2 md:grid-cols-2">{artist.concerts.map((event) => <a key={event.id} href={event.url} target="_blank" rel="noreferrer" className="glass flex items-center gap-4 rounded-2xl p-4 transition hover:bg-white/[.1]">
          <span className="grid size-14 shrink-0 place-items-center rounded-xl border border-white/15 bg-white/[.07] text-center text-[10px] font-semibold leading-4 text-white/80">{eventDate(event.date).split(",")[0]}</span>
          <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-white">{event.city || event.name}</span><span className="mt-1 block truncate text-xs text-white/60">{event.venue} · {eventDate(event.date)}</span></span><span aria-hidden className="text-white/65">↗</span>
        </a>)}</div></> : <p className="glass rounded-2xl p-5 text-sm text-white/70">{!artist.concertsConfigured ? "Concert listings need a Ticketmaster API key. Add TICKETMASTER_API_KEY to the server environment to enable dates." : !artist.concertsAvailable ? "Concert listings are temporarily unavailable. Try again later." : "No upcoming concerts were found for this artist."}</p>}
      </section>
    </div>
  </main>;
}
