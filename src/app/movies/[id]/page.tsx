import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { VideoPlayer } from "@/components/video-player";
import { WatchOptions } from "@/components/watch-options";
import { getMovieDetails, tmdbImage } from "@/lib/tmdb";
import { getMovieWatchOptions } from "@/lib/tmdb-watch";
import { AddToTimelineButton } from "@/components/add-to-timeline-button";
import type { RadarItem } from "@/lib/radar";

export default async function MovieDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isSafeInteger(id) || id <= 0) notFound();

  const [movie, watchOptions] = await Promise.all([getMovieDetails(id), getMovieWatchOptions(id)]);
  if (!movie) notFound();

  const trailer = movie.videos?.results?.find((video) => video.site === "YouTube" && video.type === "Trailer")
    ?? movie.videos?.results?.find((video) => video.site === "YouTube");
  const backdrop = tmdbImage(movie.backdrop_path, "original");
  const cast = movie.credits?.cast?.slice(0, 8) ?? [];
  const radarItem: RadarItem = {
    source: "tmdb", sourceId: String(movie.id), type: "MOVIE", title: movie.title,
    displayDate: movie.release_date ? new Date(`${movie.release_date}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }) : "Date TBA",
    releaseDate: movie.release_date || null, sortTimestamp: movie.release_date ? `${movie.release_date}T12:00:00.000Z` : null,
    isApproximate: false, posterUrl: tmdbImage(movie.poster_path), backdropUrl: backdrop,
    description: movie.overview, externalUrl: `https://www.themoviedb.org/movie/${movie.id}`,
    tmdbId: movie.id, genreIds: movie.genre_ids ?? movie.genres?.map((genre) => genre.id) ?? [],
    popularity: movie.popularity ?? 0, href: `/movies/${movie.id}`,
  };

  return (
    <main className="min-h-screen pb-32">
      <section className="relative min-h-[380px] overflow-hidden border-b border-white/10 sm:min-h-[480px]">
        {backdrop && <Image src={backdrop} alt="" fill priority sizes="100vw" className="object-cover opacity-40" />}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0b0e14] via-[#0b0e14]/65 to-[#0b0e14]/15" />
        <div className="relative mx-auto flex min-h-[380px] max-w-7xl flex-col justify-end px-5 pb-9 pt-10 sm:min-h-[480px] sm:px-8 sm:pb-14">
          <Link href="/" className="absolute top-8 inline-flex items-center gap-2 text-sm text-slate-300 hover:text-white">← Upcoming</Link>
          <p className="mb-3 text-xs font-semibold uppercase tracking-[.2em] text-cyan-200">Movie · Coming soon</p>
          <h1 className="max-w-4xl text-4xl font-semibold tracking-tight text-white sm:text-6xl">{movie.title}</h1>
          <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-slate-300">
            {movie.release_date && <span>{new Date(`${movie.release_date}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })}</span>}
            {movie.vote_average > 0 && <span className="text-amber-200">★ {movie.vote_average.toFixed(1)}</span>}
          </div>
        </div>
      </section>
      <div className="mx-auto grid max-w-7xl gap-10 px-5 pt-9 sm:px-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-9">
          <p className="max-w-3xl text-sm leading-7 text-slate-300">{movie.overview || "No synopsis is available yet."}</p>
          {trailer && <section><h2 className="mb-4 text-lg font-semibold text-white">Watch the trailer</h2><VideoPlayer videoKey={trailer.key} title={movie.title} fallbackUrl={`https://www.youtube.com/watch?v=${encodeURIComponent(trailer.key)}`} /></section>}
          {cast.length > 0 && <section><h2 className="mb-4 text-lg font-semibold text-white">Cast</h2><div className="flex gap-4 overflow-x-auto pb-2">{cast.map((person) => {
            const image = tmdbImage(person.profile_path, "w185");
            return <div key={person.id} className="w-20 shrink-0 text-center"><div className="relative mx-auto mb-2 size-16 overflow-hidden rounded-full border border-white/10 bg-white/5">{image && <Image src={image} alt={person.name} fill sizes="64px" className="object-cover" />}</div><p className="line-clamp-2 text-xs font-medium text-slate-200">{person.name}</p><p className="mt-0.5 line-clamp-2 text-[10px] text-slate-500">{person.character}</p></div>;
          })}</div></section>}
        </div>
        <aside className="space-y-4">
          <div className="glass rounded-2xl p-4">
            <p className="mb-3 text-sm font-medium text-white">Keep it on your radar</p>
            <AddToTimelineButton item={radarItem} />
          </div>
          <WatchOptions options={watchOptions} />
          <div className="glass rounded-2xl p-4 text-xs leading-5 text-slate-400">Movie information and images from TMDB. This product uses the TMDB API but is not endorsed or certified by TMDB.</div>
        </aside>
      </div>
    </main>
  );
}
