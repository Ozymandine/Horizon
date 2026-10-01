import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AddToTimelineButton } from "@/components/add-to-timeline-button";
import { AddToMyListMenu } from "@/components/add-to-my-list-menu";
import { NewsPanel } from "@/components/news-panel";
import { VideoPlayer } from "@/components/video-player";
import { WatchOptions } from "@/components/watch-options";
import { getShowDetails, tmdbImage } from "@/lib/tmdb";
import { getShowWatchOptions } from "@/lib/tmdb-watch";
import type { RadarItem } from "@/lib/radar";
import { returnLabel, safeReturnTo } from "@/lib/return-to";

export default async function ShowDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams?: Promise<{ returnTo?: string }> }) {
  const { id: rawId } = await params;
  const backTo = safeReturnTo((await searchParams)?.returnTo);
  const id = Number(rawId);
  if (!Number.isSafeInteger(id) || id <= 0) notFound();
  const [show, watchOptions] = await Promise.all([getShowDetails(id), getShowWatchOptions(id)]);
  if (!show) notFound();

  const backdrop = tmdbImage(show.backdrop_path, "original");
  const logoPath = show.images?.logos?.find((logo) => logo.iso_639_1 === "en")?.file_path
    ?? show.images?.logos?.find((logo) => logo.iso_639_1 === null)?.file_path;
  const logo = tmdbImage(logoPath ?? null, "original");
  const trailer = show.videos?.results?.find((video) => video.site === "YouTube" && video.type === "Trailer")
    ?? show.videos?.results?.find((video) => video.site === "YouTube");
  const date = show.first_air_date ? new Date(`${show.first_air_date}T12:00:00Z`) : null;
  const formattedDate = date?.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
  const radarItem: RadarItem = {
    source: "tmdb", sourceId: String(show.id), type: "SHOW", title: show.name,
    displayDate: formattedDate ?? "Date TBA",
    releaseDate: show.first_air_date || null, sortTimestamp: show.first_air_date ? `${show.first_air_date}T12:00:00.000Z` : null,
    isApproximate: false, posterUrl: tmdbImage(show.poster_path), backdropUrl: backdrop,
    description: show.overview, externalUrl: `https://www.themoviedb.org/tv/${show.id}`,
    tmdbId: show.id, genreIds: show.genre_ids ?? show.genres?.map((genre) => genre.id) ?? [],
    popularity: show.popularity ?? 0, voteAverage: show.vote_average, voteCount: show.vote_count, href: `/shows/${show.id}`,
  };

  return (
    <main className="min-h-screen pb-32">
      <section className="relative min-h-[650px] overflow-hidden border-b border-white/10 sm:min-h-[740px]">
        {backdrop && <Image src={backdrop} alt="" fill priority sizes="100vw" className="object-cover object-top opacity-60" />}
        <div className="absolute inset-0 bg-gradient-to-r from-[#080b10]/95 via-[#080b10]/65 to-[#080b10]/20" /><div className="absolute inset-0 bg-gradient-to-t from-[#0b0e14] via-transparent to-black/20" />
        <div className="relative mx-auto grid min-h-[650px] max-w-7xl items-end gap-10 px-5 pb-10 pt-20 sm:min-h-[740px] sm:px-8 sm:pb-14 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="max-w-3xl">
            <Link href={backTo} className="absolute top-8 inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/20 px-4 py-2 text-sm text-slate-200 backdrop-blur-md transition hover:bg-white/10">← {returnLabel(backTo)}</Link>
            {logo ? <Image src={logo} alt={show.name} width={640} height={240} priority className="mb-5 max-h-32 w-auto max-w-full object-contain object-left sm:max-h-44" /> : <h1 className="mb-5 max-w-4xl text-4xl font-semibold tracking-tight text-white sm:text-6xl">{show.name}</h1>}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-white/85">{show.genres?.map((genre, index) => <span key={genre.id} className="flex items-center gap-2">{index > 0 && <span aria-hidden className="text-white/40">•</span>}{genre.name}</span>)}</div>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <AddToTimelineButton item={radarItem} />
              <AddToMyListMenu item={radarItem} />
              {trailer && <a href="#trailer" className="detail-action"><span aria-hidden="true">▶</span> Trailer</a>}
              {show.vote_average > 0 && <span className="detail-action text-amber-100"><span aria-hidden="true">★</span> {show.vote_average.toFixed(1)} <span className="text-xs text-slate-400">TMDB</span></span>}
            </div>
            {show.overview && <p className="mt-6 max-w-2xl text-sm leading-7 text-slate-200/90 sm:text-base">{show.overview}</p>}
            <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-300/80">
              {date && <span>First aired · {formattedDate}</span>}
              {show.number_of_seasons ? <span>{show.number_of_seasons} seasons</span> : null}
              {show.number_of_episodes ? <span>{show.number_of_episodes} episodes</span> : null}
            </div>
          </div>
          <div className="relative hidden h-[430px] w-[286px] justify-self-end overflow-hidden rounded-[1.4rem] border border-white/15 bg-black/30 shadow-2xl shadow-black/50 lg:block">
            {show.poster_path && <Image src={tmdbImage(show.poster_path, "w500")!} alt={`${show.name} poster`} fill sizes="286px" priority className="object-cover" />}
          </div>
        </div>
      </section>
      <div className="mx-auto grid max-w-7xl gap-10 px-5 pt-9 sm:px-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-10">
          {trailer && <section id="trailer"><h2 className="mb-4 text-xl font-semibold text-white">Trailers & clips</h2><VideoPlayer videoKey={trailer.key} title={show.name} fallbackUrl={`https://www.youtube.com/watch?v=${encodeURIComponent(trailer.key)}`} /></section>}
          {(show.credits?.cast?.length ?? 0) > 0 && <section><h2 className="mb-5 text-xl font-semibold text-white">Cast</h2><div className="flex gap-5 overflow-x-auto pb-3">{show.credits?.cast.slice(0, 10).map((person) => {
            const image = tmdbImage(person.profile_path, "w185");
            return <div key={person.id} className="w-24 shrink-0 text-center"><div className="relative mx-auto mb-3 size-20 overflow-hidden rounded-full border border-white/10 bg-white/5">{image && <Image src={image} alt={person.name} fill sizes="80px" className="object-cover" />}</div><p className="line-clamp-2 text-xs font-semibold text-slate-100">{person.name}</p><p className="mt-1 line-clamp-2 text-[10px] leading-4 text-slate-400">{person.character}</p></div>;
          })}</div></section>}
        </div>
        <aside className="space-y-4"><WatchOptions options={watchOptions} /><NewsPanel title={show.name} /><div className="glass rounded-2xl p-4 text-xs leading-5 text-slate-400">Series details and artwork from TMDB. This product uses the TMDB API but is not endorsed or certified by TMDB.</div></aside>
      </div>
    </main>
  );
}
