import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AddToTimelineButton } from "@/components/add-to-timeline-button";
import { AddToMyListMenu } from "@/components/add-to-my-list-menu";
import { MediaArtwork } from "@/components/media-artwork";
import { NewsPanel } from "@/components/news-panel";
import { getMusicReleaseDetails, getSteamGameDetails, getUpcomingRadar, type RadarItem } from "@/lib/radar";
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

export default async function ReleaseDetailPage({ params, searchParams }: {
  params: Promise<{ source: string; id: string }>;
  searchParams?: Promise<{ returnTo?: string }>;
}) {
  const { source, id } = await params;
  const backTo = safeReturnTo((await searchParams)?.returnTo);
  let item: RadarItem | null = null;
  let steam: Awaited<ReturnType<typeof getSteamGameDetails>> = null;
  let music: Awaited<ReturnType<typeof getMusicReleaseDetails>> = null;

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
        backdropUrl: steam.background, description: steam.shortDescription || "Game details from Steam.",
        externalUrl: `https://store.steampowered.com/app/${steam.appId}/`, tmdbId: null,
        genreIds: [], popularity: steam.recommendations ?? 0, href: `/releases/steam/${steam.appId}`,
      };
    }
  } else if (source === "musicbrainz") {
    music = await getMusicReleaseDetails(id);
    if (music) {
      const date = music.releaseDate !== "Release date unavailable" ? new Date(`${music.releaseDate}T12:00:00Z`) : null;
      const iso = date && Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : null;
      item = {
        source: "musicbrainz", sourceId: music.id, type: "MUSIC", title: music.title,
        displayDate: music.releaseDate === "Release date unavailable" ? music.releaseDate : `${formatted(music.releaseDate)} · ${music.artist}`,
        releaseDate: iso, sortTimestamp: iso ? `${iso}T12:00:00.000Z` : null,
        isApproximate: !iso, posterUrl: music.coverUrl, backdropUrl: null,
        description: `Album by ${music.artist}.`, externalUrl: `https://musicbrainz.org/release-group/${music.id}`,
        tmdbId: null, genreIds: [], popularity: 0, href: `/releases/musicbrainz/${music.id}`,
      };
    }
  }

  item ??= Object.values(await getUpcomingRadar()).flat().find((release) => release.source === source && release.sourceId === id) ?? null;
  if (!item) notFound();

  const title = source === "musicbrainz" && music ? `${music.title} · ${music.artist}` : item.title;
  const label = item.type === "GAME" ? "Game" : item.type === "MUSIC" ? "Album" : item.type === "SHOW" ? "Series" : "Movie";
  const header = steam?.background ?? item.backdropUrl ?? steam?.headerImage ?? null;

  return <main className="min-h-screen px-5 pb-32 pt-8 sm:px-8 sm:pt-12">
    <div className="mx-auto max-w-7xl">
      <Link href={backTo} className="inline-flex items-center gap-2 text-sm text-slate-300 transition hover:text-white">← {returnLabel(backTo)}</Link>
      <section className="relative mt-6 min-h-[490px] overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950 lg:min-h-[590px]">
        {header && <Image src={header} alt="" fill priority sizes="100vw" className="object-cover opacity-45" />}
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/85 to-slate-950/35" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-black/20" />
        <div className="relative grid min-h-[490px] items-end gap-8 p-6 sm:p-10 lg:min-h-[590px] lg:grid-cols-[minmax(0,1fr)_270px] lg:p-12">
          <div className="max-w-3xl">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[.2em] text-slate-300">{label}</p>
            <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-6xl">{title}</h1>
            <p className="mt-4 text-sm font-medium text-cyan-100/85">{item.displayDate}</p>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-slate-200/90">{steam?.shortDescription || item.description || "Release details will be added as they become available."}</p>
            {(steam?.genres.length || music?.tags.length) ? <div className="mt-5 flex flex-wrap gap-2">{(steam?.genres ?? music?.tags ?? []).map((tag) => <span key={tag} className="rounded-full border border-white/15 bg-white/[.06] px-3 py-1.5 text-xs text-white/80">{tag}</span>)}</div> : null}
            <div className="mt-7 flex flex-wrap items-center gap-3"><AddToTimelineButton item={item} /><AddToMyListMenu item={item} />{item.externalUrl && <a href={item.externalUrl} target="_blank" rel="noreferrer" className="detail-action">Official page <span aria-hidden="true">↗</span></a>}</div>
            {steam && <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-300/80">{steam.developers.length > 0 && <span>Developer · {steam.developers.join(", ")}</span>}{steam.publishers.length > 0 && <span>Publisher · {steam.publishers.join(", ")}</span>}{steam.recommendations !== null && <span>{steam.recommendations.toLocaleString()} Steam recommendations</span>}</div>}
          </div>
          <div className="relative hidden h-[390px] w-[260px] justify-self-end overflow-hidden rounded-[1.4rem] border border-white/15 bg-black/30 shadow-2xl shadow-black/50 lg:block"><MediaArtwork title={item.title} type={item.type} imageUrl={item.posterUrl} fallbackUrls={item.posterFallbackUrls} /><div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" /></div>
        </div>
      </section>

      {steam?.detailedDescription && <section className="mt-10 max-w-4xl"><h2 className="mb-3 text-xl font-semibold text-white">About this game</h2><p className="whitespace-pre-line text-sm leading-7 text-slate-300">{cleanDescription(steam.detailedDescription)}</p></section>}
      {steam?.trailers.length ? <section className="mt-10"><h2 className="mb-4 text-xl font-semibold text-white">Trailers</h2><div className="grid gap-5 md:grid-cols-2">{steam.trailers.map((trailer, index) => <article key={`${trailer.name}:${index}`} className="overflow-hidden rounded-2xl border border-white/10 bg-black/35"><video controls preload="none" poster={trailer.poster} className="aspect-video w-full bg-black"><source src={trailer.webm ?? trailer.mp4 ?? ""} type={trailer.webm ? "video/webm" : "video/mp4"} /></video><p className="px-4 py-3 text-sm font-medium text-white">{trailer.name}</p></article>)}</div></section> : null}
      {steam?.screenshots.length ? <section className="mt-10"><h2 className="mb-4 text-xl font-semibold text-white">Screenshots</h2><div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{steam.screenshots.map((url) => <div key={url} className="relative aspect-video overflow-hidden rounded-2xl border border-white/10"><Image src={url} alt={`${item.title} screenshot`} fill sizes="(max-width: 640px) 100vw, 33vw" className="object-cover" /></div>)}</div></section> : null}
      {music && <section className="mt-10"><h2 className="mb-4 text-xl font-semibold text-white">Album previews</h2>{music.tracks.length ? <div className="grid gap-3 md:grid-cols-2">{music.tracks.map((track, index) => <article key={`${track.title}:${index}`} className="glass flex min-w-0 items-center gap-4 rounded-2xl p-3">{track.artworkUrl && <div className="relative size-14 shrink-0 overflow-hidden rounded-xl"><Image src={track.artworkUrl} alt="" fill sizes="56px" className="object-cover" /></div>}<div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-white">{track.title}</p><p className="truncate text-xs text-slate-400">{track.artist}</p></div>{track.previewUrl ? <audio controls preload="none" src={track.previewUrl} aria-label={`Preview ${track.title}`} className="h-9 w-40 max-w-[42%]" /> : <span className="text-xs text-slate-500">Preview unavailable</span>}</article>)}</div> : <p className="glass rounded-2xl p-5 text-sm text-slate-400">No playable previews are available for this album yet.</p>}</section>}
      <div className="mt-10 max-w-3xl"><NewsPanel title={title} /></div>
    </div>
  </main>;
}
