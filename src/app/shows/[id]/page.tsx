import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, CalendarDays, Star } from "lucide-react";
import { notFound } from "next/navigation";
import { AddToTimelineButton } from "@/components/add-to-timeline-button";
import { NewsPanel } from "@/components/news-panel";
import { VideoPlayer } from "@/components/video-player";
import { getShowDetails, tmdbImage } from "@/lib/tmdb";
import type { RadarItem } from "@/lib/radar";

export default async function ShowDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isSafeInteger(id) || id <= 0) notFound();
  const show = await getShowDetails(id);
  if (!show) notFound();

  const backdrop = tmdbImage(show.backdrop_path, "original");
  const trailer = show.videos?.results?.find((video) => video.site === "YouTube" && video.type === "Trailer")
    ?? show.videos?.results?.find((video) => video.site === "YouTube");
  const date = show.first_air_date ? new Date(`${show.first_air_date}T12:00:00Z`) : null;
  const radarItem: RadarItem = {
    source: "tmdb", sourceId: String(show.id), type: "SHOW", title: show.name,
    displayDate: date ? date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }) : "Date TBA",
    releaseDate: show.first_air_date || null, sortTimestamp: show.first_air_date ? `${show.first_air_date}T12:00:00.000Z` : null,
    isApproximate: false, posterUrl: tmdbImage(show.poster_path), backdropUrl: backdrop,
    description: show.overview, externalUrl: `https://www.themoviedb.org/tv/${show.id}`,
    tmdbId: show.id, genreIds: show.genre_ids ?? show.genres?.map((genre) => genre.id) ?? [],
    popularity: show.popularity ?? 0, href: `/shows/${show.id}`,
  };

  return (
    <main className="min-h-screen pb-32">
      <section className="relative min-h-[380px] overflow-hidden border-b border-white/10 sm:min-h-[480px]">
        {backdrop && <Image src={backdrop} alt="" fill priority sizes="100vw" className="object-cover opacity-40" />}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0b0e14] via-[#0b0e14]/65 to-[#0b0e14]/15" />
        <div className="relative mx-auto flex min-h-[380px] max-w-7xl flex-col justify-end px-5 pb-9 pt-10 sm:min-h-[480px] sm:px-8 sm:pb-14">
          <Link href="/" className="absolute top-8 inline-flex items-center gap-2 text-sm text-slate-300 hover:text-white"><ArrowLeft size={15} /> Upcoming</Link>
          <p className="mb-3 text-xs font-semibold uppercase tracking-[.2em] text-cyan-200">TV · New and returning series</p>
          <h1 className="max-w-4xl text-4xl font-semibold tracking-tight text-white sm:text-6xl">{show.name}</h1>
          <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-slate-300">
            {date && <span className="flex items-center gap-2"><CalendarDays size={15} />{date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })}</span>}
            {show.vote_average > 0 && <span className="flex items-center gap-1"><Star size={14} className="fill-amber-300 text-amber-300" />{show.vote_average.toFixed(1)}</span>}
          </div>
        </div>
      </section>
      <div className="mx-auto grid max-w-7xl gap-10 px-5 pt-9 sm:px-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-9">
          <p className="max-w-3xl text-sm leading-7 text-slate-300">{show.overview || "No synopsis is available yet."}</p>
          {trailer && <section><h2 className="mb-4 text-lg font-semibold text-white">Watch the trailer</h2><VideoPlayer videoKey={trailer.key} title={show.name} fallbackUrl={`https://www.youtube.com/watch?v=${encodeURIComponent(trailer.key)}`} /></section>}
          {(show.credits?.cast?.length ?? 0) > 0 && <section><h2 className="mb-4 text-lg font-semibold text-white">Cast</h2><div className="flex gap-4 overflow-x-auto pb-2">{show.credits?.cast.slice(0, 8).map((person) => {
            const image = tmdbImage(person.profile_path, "w185");
            return <div key={person.id} className="w-20 shrink-0 text-center"><div className="relative mx-auto mb-2 size-16 overflow-hidden rounded-full border border-white/10 bg-white/5">{image && <Image src={image} alt={person.name} fill sizes="64px" className="object-cover" />}</div><p className="line-clamp-2 text-xs font-medium text-slate-200">{person.name}</p><p className="mt-0.5 line-clamp-2 text-[10px] text-slate-500">{person.character}</p></div>;
          })}</div></section>}
        </div>
        <aside className="space-y-4">
          <div className="glass rounded-2xl p-4"><p className="mb-3 text-sm font-medium text-white">Keep it on your radar</p><AddToTimelineButton item={radarItem} /></div>
          <NewsPanel title={show.name} />
          <div className="glass rounded-2xl p-4 text-xs leading-5 text-slate-400">TV details and artwork from TMDB. This product uses the TMDB API but is not endorsed or certified by TMDB.</div>
        </aside>
      </div>
    </main>
  );
}
