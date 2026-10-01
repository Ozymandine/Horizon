import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AddToTimelineButton } from "@/components/add-to-timeline-button";
import { AddToMyListMenu } from "@/components/add-to-my-list-menu";
import { GameDetail } from "@/components/game-detail";
import { MediaArtwork } from "@/components/media-artwork";
import { MusicTrackList } from "@/components/music-track-list";
import { SpotifyAlbumCatalog } from "@/components/spotify-music";
import { NewsPanel } from "@/components/news-panel";
import { getMusicRecordingDetails, getMusicReleaseDetails, getRawgGameDetails, getSteamGameDetails, getUpcomingRadar, type RadarItem } from "@/lib/radar";
import { returnLabel, safeReturnTo } from "@/lib/return-to";

function formatted(value: string) {
  if (!value || value === "Coming soon" || value === "Release date unavailable") return value || "Release date unavailable";
  const date = new Date(`${value.slice(0, 10)}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
}

function cleanDescription(value: string) {
  return value.replace(/<br\s*\/?\s*>/gi, "\n").replace(/<\/p\s*>/gi, "\n\n")
    .replace(/<[^>]*>/g, " ").replace(/\[(?:\/)?(?:h[1-6]|p|b|i|u|list|\*|quote|url)[^\]]*\]/gi, " ")
    .replace(/&nbsp;|&#160;/gi, " ").replace(/&amp;/gi, "&").replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
    .replace(/[ \t]+/g, " ").replace(/\n[ \t]+/g, "\n").trim().slice(0, 8000);
}

function trackLength(milliseconds: number | null | undefined) {
  if (!milliseconds) return "";
  const seconds = Math.floor(milliseconds / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export default async function ReleaseDetailPage({ params, searchParams }: {
  params: Promise<{ source: string; id: string }>;
  searchParams?: Promise<{ returnTo?: string }>;
}) {
  const { source, id } = await params;
  const backTo = safeReturnTo((await searchParams)?.returnTo);
  let item: RadarItem | null = null;
  let steam: Awaited<ReturnType<typeof getSteamGameDetails>> = null;
  let rawg: Awaited<ReturnType<typeof getRawgGameDetails>> = null;
  let music: Awaited<ReturnType<typeof getMusicReleaseDetails>> = null;
  let recording: Awaited<ReturnType<typeof getMusicRecordingDetails>> = null;

  if (source === "steam") {
    steam = await getSteamGameDetails(id);
    if (steam) {
      const date = steam.releaseDate && steam.releaseDate !== "Coming soon" ? new Date(steam.releaseDate) : null;
      const iso = date && Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : null;
      item = {
        source: "steam", sourceId: steam.appId, type: "GAME", title: steam.name,
        displayDate: steam.comingSoon ? `Coming soon · ${steam.releaseDate}` : steam.releaseDate,
        releaseDate: iso, sortTimestamp: iso ? `${iso}T12:00:00.000Z` : null,
        isApproximate: !iso, posterUrl: `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${steam.appId}/library_600x900.jpg`,
        posterFallbackUrls: [`https://cdn.cloudflare.steamstatic.com/steam/apps/${steam.appId}/header.jpg`, ...(steam.headerImage ? [steam.headerImage] : [])],
        backdropUrl: steam.background ?? steam.screenshots[0] ?? null, description: steam.shortDescription || "Game details from Steam.",
        externalUrl: `https://store.steampowered.com/app/${steam.appId}/`, tmdbId: null,
        genreIds: [], popularity: steam.recommendations ?? 0, href: `/releases/steam/${steam.appId}`,
      };
    }
  } else if (source === "rawg") {
    rawg = await getRawgGameDetails(id);
    if (rawg) {
      const iso = /^\d{4}-\d{2}-\d{2}$/.test(rawg.released) ? rawg.released : null;
      item = {
        source: "rawg", sourceId: rawg.id, type: "GAME", title: rawg.name,
        displayDate: iso ? formatted(iso) : "Release date not listed", releaseDate: iso,
        sortTimestamp: iso ? `${iso}T12:00:00.000Z` : null, isApproximate: !iso,
        posterUrl: rawg.backgroundImage, backdropUrl: rawg.backgroundImage, description: cleanDescription(rawg.description),
        externalUrl: rawg.website ?? `https://rawg.io/games/${rawg.slug}`, tmdbId: null, genreIds: [],
        popularity: rawg.ratingsCount, tags: rawg.genres, voteAverage: rawg.rating ?? undefined,
        voteCount: rawg.ratingsCount, ratingScale: 5, ratingSource: "RAWG", href: `/releases/rawg/${rawg.slug}`,
      };
    }
  } else if (source === "musicbrainz") {
    music = await getMusicReleaseDetails(id);
    if (music) {
      const date = music.releaseDate !== "Release date unavailable" ? new Date(`${music.releaseDate}T12:00:00Z`) : null;
      const iso = date && Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : null;
      item = {
        source: "musicbrainz", sourceId: music.id, type: "MUSIC", title: music.title,
        displayDate: music.releaseDate === "Release date unavailable" ? music.releaseDate : formatted(music.releaseDate),
        releaseDate: iso, sortTimestamp: iso ? `${iso}T12:00:00.000Z` : null,
        isApproximate: !iso, posterUrl: music.coverUrl, backdropUrl: music.coverUrl,
        posterFallbackUrls: music.coverFallbackUrls,
        description: `Album by ${music.artist}.`, externalUrl: `https://musicbrainz.org/release-group/${music.id}`,
        tmdbId: null, genreIds: [], popularity: 0, href: `/releases/musicbrainz/${music.id}`,
      };
    }
  } else if (source === "musicbrainz-recording") {
    recording = await getMusicRecordingDetails(id);
    if (recording) {
      const date = recording.firstReleaseDate ? new Date(`${recording.firstReleaseDate}T12:00:00Z`) : null;
      const iso = date && Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : null;
      item = {
        source: "musicbrainz-recording", sourceId: recording.id, type: "MUSIC", title: recording.title,
        displayDate: iso ? formatted(recording.firstReleaseDate) : "Release date not listed",
        releaseDate: iso, sortTimestamp: iso ? `${iso}T12:00:00.000Z` : null,
        isApproximate: !iso, posterUrl: recording.artworkUrl, backdropUrl: recording.artworkUrl,
        description: iso ? `Track by ${recording.artist}.` : `No first-release date is listed for this recording in MusicBrainz. ${recording.disambiguation}`.trim(),
        externalUrl: `https://musicbrainz.org/recording/${recording.id}`, tmdbId: null,
        genreIds: [], popularity: 0, href: `/releases/musicbrainz-recording/${recording.id}`,
      };
    }
  }

  item ??= Object.values(await getUpcomingRadar()).flat().find((release) => release.source === source && release.sourceId === id) ?? null;
  if (!item) notFound();

  const title = music?.title ?? recording?.title ?? item.title;
  const label = item.type === "GAME" ? "Game" : item.type === "MUSIC" ? recording ? "Song" : "Album" : item.type === "SHOW" ? "Show" : "Movie";
  const musicArt = music?.coverUrl ?? recording?.artworkUrl ?? null;
  const gameArt = steam?.screenshots[0] ?? steam?.background ?? steam?.headerImage ?? rawg?.backgroundImage ?? item.posterUrl;
  const detailArt = item.type === "MUSIC" ? musicArt : gameArt;
  const header = item.type === "MUSIC" ? musicArt : steam?.background ?? steam?.screenshots[0] ?? rawg?.backgroundImage ?? item.backdropUrl ?? steam?.headerImage ?? null;

  const albumPageStyle = musicArt ? { backgroundImage: `linear-gradient(180deg, rgba(5, 8, 17, .83), rgba(5, 9, 16, .93) 52%, rgba(5, 9, 16, .98)), url("${musicArt}")`, backgroundAttachment: "fixed" as const, backgroundPosition: "center top", backgroundSize: "cover" } : undefined;

  if (item.type === "GAME") return <GameDetail item={item} steam={steam} rawg={rawg} backTo={backTo} />;

  return <main className="min-h-screen px-5 pb-32 pt-5 sm:px-8 sm:pt-8" style={albumPageStyle}>
    <div className="mx-auto max-w-7xl">
      <Link href={backTo} className="inline-flex items-center gap-2 text-sm text-white/80 transition hover:text-white">← {returnLabel(backTo)}</Link>
      <section className={`relative mt-6 ${music ? "min-h-[280px] lg:min-h-[320px]" : "min-h-[520px] lg:min-h-[590px]"} overflow-hidden rounded-[2rem] border border-white/15 bg-slate-950/80 shadow-2xl shadow-black/30`}>
        {header && <Image src={header} alt="" fill priority sizes="100vw" className="object-cover opacity-35" />}
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/95 via-slate-950/80 to-slate-950/40" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-transparent to-black/15" />
        <div className={`relative grid ${music ? "min-h-[280px] items-center gap-5 p-5 sm:p-7 lg:min-h-[320px] lg:grid-cols-[minmax(190px,240px)_minmax(0,1fr)] lg:gap-8 lg:p-8" : "min-h-[520px] items-end gap-8 p-6 sm:p-10 lg:min-h-[590px] lg:p-12 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]"}`}>
          <div className={`max-w-3xl ${music ? "order-last lg:order-last" : ""}`}>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[.2em] text-white/85">{label}{recording && !recording.firstReleaseDate ? " · Date not listed" : ""}</p>
            <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-6xl">{title}</h1>
            <p className="mt-4 text-sm font-medium text-white/90">{recording ? recording.firstReleaseDate ? formatted(recording.firstReleaseDate) : "No first-release date listed" : item.displayDate}</p>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-white/85">{steam?.shortDescription || recording?.disambiguation || item.description || "Release details will be added as they become available."}</p>
            {(steam?.genres.length || music?.tags.length || item.tags?.length) ? <div className="mt-5 flex flex-wrap gap-2">{(steam?.genres ?? music?.tags ?? item.tags ?? []).map((tag) => <span key={tag} className="rounded-full border border-white/20 bg-white/[.08] px-3 py-1.5 text-xs text-white">{tag}</span>)}</div> : null}
            <div className="mt-7 flex flex-wrap items-center gap-3"><AddToTimelineButton item={item} /><AddToMyListMenu item={item} />{item.externalUrl && <a href={item.externalUrl} target="_blank" rel="noreferrer" className="detail-action">Open official listing <span aria-hidden="true">↗</span></a>}</div>
            {steam && <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-xs text-white/80">{steam.developers.length > 0 && <span>Developer · {steam.developers.join(", ")}</span>}{steam.publishers.length > 0 && <span>Publisher · {steam.publishers.join(", ")}</span>}{steam.recommendations !== null && <span>{steam.recommendations.toLocaleString()} Steam recommendations</span>}</div>}
            {rawg && <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-xs text-white/80">{rawg.developers.length > 0 && <span>Developer · {rawg.developers.join(", ")}</span>}{rawg.publishers.length > 0 && <span>Publisher · {rawg.publishers.join(", ")}</span>}{rawg.rating !== null && <span>Rating · {rawg.rating.toFixed(1)}/5 from {rawg.ratingsCount.toLocaleString()} RAWG ratings</span>}{rawg.metacritic !== null && <span>Metacritic · {rawg.metacritic}/100</span>}</div>}
            {music && <p className="mt-6 text-xs text-white/80">First release · {formatted(music.releaseDate)}{music.artistId ? <> · <Link href={`/artists/${music.artistId}`} className="underline decoration-white/35 underline-offset-4 hover:text-white">{music.artist}</Link></> : ` · ${music.artist}`}</p>}
            {recording && <p className="mt-6 text-xs text-white/80">{recording.length ? `Track length · ${trackLength(recording.length)}` : "Music recording"} · MusicBrainz catalog</p>}
          </div>
          <div className={`relative order-first mx-auto overflow-hidden rounded-[1.4rem] border border-white/20 bg-black/35 shadow-2xl shadow-black/50 ${music ? "aspect-square w-full max-w-[220px] lg:max-w-[240px] lg:order-first" : "w-full lg:order-last"} ${item.type === "MUSIC" ? "aspect-square" : "aspect-video lg:aspect-[4/3]"}`}>
            {detailArt ? <Image src={detailArt} alt={`${item.title} ${item.type === "MUSIC" ? "cover art" : "artwork"}`} fill priority sizes="(max-width: 1024px) 90vw, 360px" className="object-cover" /> : <MediaArtwork title={item.title} type={item.type} imageUrl={item.posterUrl} fallbackUrls={item.posterFallbackUrls} />}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-white/[.04]" />
          </div>
        </div>
      </section>

      {music && <SpotifyAlbumCatalog title={music.title} artist={music.artist} returnTo={`/releases/musicbrainz/${music.id}`} fallback={<section className="mt-10"><div className="mb-4"><h2 className="text-xl font-semibold text-white">Songs</h2><p className="mt-1 text-sm text-white/65">Play full tracks from Spotify.</p></div><MusicTrackList tracks={music.tracks} returnTo={`/releases/musicbrainz/${music.id}`} /></section>} />}
      {music && <section className="glass mt-10 max-w-5xl rounded-3xl p-6 sm:p-8">
        <h2 className="text-xl font-semibold text-white">Album history and notes</h2>
        <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2"><div><dt className="text-xs uppercase tracking-[.14em] text-white/55">Artist</dt><dd className="mt-1 text-white">{music.artistId ? <Link href={`/artists/${music.artistId}`} className="underline decoration-white/30 underline-offset-4 hover:text-white">{music.artist}</Link> : music.artist}</dd></div><div><dt className="text-xs uppercase tracking-[.14em] text-white/55">First release</dt><dd className="mt-1 text-white">{formatted(music.releaseDate)}</dd></div>{music.tags.length > 0 && <div className="sm:col-span-2"><dt className="text-xs uppercase tracking-[.14em] text-white/55">Catalog tags</dt><dd className="mt-2 flex flex-wrap gap-2">{music.tags.map((tag) => <span key={tag} className="rounded-full border border-white/15 bg-white/[.06] px-3 py-1 text-xs text-white/80">{tag}</span>)}</dd></div>}</dl>
        {music.history && <div className="mt-6 border-t border-white/10 pt-5"><h3 className="font-medium text-white">Release history</h3><p className="mt-2 text-sm leading-7 text-white/75">{music.history}</p>{music.historyUrl && <a href={music.historyUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-xs text-white/80 underline decoration-white/30 underline-offset-4 hover:text-white">Read source article ↗</a>}</div>}
        <p className="mt-5 text-xs leading-5 text-white/55">Track interpretations vary by listener. This catalog lists source-backed release information and does not present unsourced meanings as fact.</p>
      </section>}
      {recording && <section className="glass mt-8 flex flex-col gap-5 rounded-3xl p-5 sm:flex-row sm:items-center sm:p-7">
        {recording.artworkUrl && <div className="relative aspect-square w-full max-w-36 shrink-0 overflow-hidden rounded-2xl border border-white/15"><Image src={recording.artworkUrl} alt="Track artwork" fill sizes="144px" className="object-cover" /></div>}
        <div className="min-w-0 flex-1"><p className="text-xs font-semibold uppercase tracking-[.16em] text-white/65">{recording.firstReleaseDate ? "Released song" : "Catalog song · Date not listed"}</p><h2 className="mt-2 text-xl font-semibold text-white">{recording.title}</h2><p className="mt-1 text-sm text-white/75">{recording.firstReleaseDate ? `First release · ${formatted(recording.firstReleaseDate)}` : "MusicBrainz has no first-release date for this song; its release status may be incomplete."}</p></div>
      </section>}
      {recording && <div className="mt-3"><MusicTrackList tracks={[{ title: recording.title, artist: recording.artist, artworkUrl: recording.artworkUrl, year: recording.firstReleaseDate?.slice(0, 4) }]} returnTo={`/releases/musicbrainz-recording/${recording.id}`} /></div>}
      <div className="mt-10 max-w-3xl"><NewsPanel title={title} artist={music?.artist ?? recording?.artist ?? ""} /></div>
    </div>
  </main>;
}
