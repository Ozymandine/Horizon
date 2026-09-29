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
  const logoPath = movie.images?.logos?.find((logo) => logo.iso_639_1 === "en")?.file_path
    ?? movie.images?.logos?.find((logo) => logo.iso_639_1 === null)?.file_path;
  const logo = tmdbImage(logoPath ?? null, "original");
  const cast = movie.credits?.cast?.slice(0, 10) ?? [];
  const usDates = movie.release_dates?.results.find((region) => region.iso_3166_1 === "US")?.release_dates ?? [];
  const releaseDateText = usDates.find((release) => release.type === 3)?.release_date
    ?? usDates.find((release) => release.release_date)?.release_date
    ?? movie.release_date;
  const releaseDate = releaseDateText ? new Date(releaseDateText) : null;
  const formattedDate = releaseDate?.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
  const radarItem: RadarItem = {
    source: "tmdb", sourceId: String(movie.id), type: "MOVIE", title: movie.title,
    displayDate: formattedDate ?? "Date TBA",
    releaseDate: releaseDateText?.slice(0, 10) || null, sortTimestamp: releaseDateText ? `${releaseDateText.slice(0, 10)}T12:00:00.000Z` : null,
    isApproximate: false, posterUrl: tmdbImage(movie.poster_path), backdropUrl: backdrop,
    description: movie.overview, externalUrl: `https://www.themoviedb.org/movie/${movie.id}`,
    tmdbId: movie.id, genreIds: movie.genre_ids ?? movie.genres?.map((genre) => genre.id) ?? [],
    popularity: movie.popularity ?? 0, voteAverage: movie.vote_average, voteCount: movie.vote_count, href: `/movies/${movie.id}`,
  };

  return (
    <main className="min-h-screen pb-32">
      <section className="relative min-h-[670px] overflow-hidden border-b border-white/10 sm:min-h-[760px]">
        {backdrop && <Image src={backdrop} alt="" fill priority sizes="100vw" className="object-cover object-top opacity-60" />}
        <div className="absolute inset-0 bg-gradient-to-r from-[#080b10]/95 via-[#080b10]/65 to-[#080b10]/20" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0b0e14] via-transparent to-black/20" />
        <div className="relative mx-auto grid min-h-[670px] max-w-7xl items-end gap-10 px-5 pb-10 pt-20 sm:min-h-[760px] sm:px-8 sm:pb-14 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="max-w-3xl">
            <Link href="/" className="absolute top-8 inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/20 px-4 py-2 text-sm text-slate-200 backdrop-blur-md transition hover:bg-white/10">← Upcoming</Link>
            {movie.tagline && <p className="mb-4 text-sm italic text-white/75">{movie.tagline}</p>}
            {logo ? <><h1 className="sr-only">{movie.title}</h1><Image src={logo} alt={movie.title} width={640} height={240} priority className="mb-5 max-h-32 w-auto max-w-full object-contain object-left drop-shadow-[0_4px_18px_rgba(0,0,0,0.95)] sm:max-h-44" /></> : <h1 className="mb-5 max-w-4xl text-4xl font-semibold tracking-tight text-white sm:text-6xl">{movie.title}</h1>}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-white/85">{movie.genres?.map((genre, index) => <span key={genre.id} className="flex items-center gap-2">{index > 0 && <span aria-hidden className="text-white/40">•</span>}{genre.name}</span>)}</div>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <AddToTimelineButton item={radarItem} />
              {trailer && <a href="#trailer" className="detail-action"><span aria-hidden="true">▶</span> Trailer</a>}
              {movie.vote_average > 0 && <span className="detail-action text-amber-100"><span aria-hidden="true">★</span> {movie.vote_average.toFixed(1)} <span className="text-xs text-slate-400">TMDB</span></span>}
            </div>
            {movie.overview && <p className="mt-6 max-w-2xl text-sm leading-7 text-slate-200/90 sm:text-base">{movie.overview}</p>}
            <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-300/80">
              {releaseDate && <span>Release date · {formattedDate}</span>}
              {movie.runtime ? <span>Runtime · {Math.floor(movie.runtime / 60)}h {movie.runtime % 60}m</span> : null}
              {movie.original_language && <span>Original language · {movie.original_language.toUpperCase()}</span>}
            </div>
          </div>
          <div className="relative hidden h-[430px] w-[286px] justify-self-end overflow-hidden rounded-[1.4rem] border border-white/15 bg-black/30 shadow-2xl shadow-black/50 lg:block">
            {movie.poster_path && <Image src={tmdbImage(movie.poster_path, "w500")!} alt={`${movie.title} poster`} fill sizes="286px" priority className="object-cover" />}
            <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-7xl gap-10 px-5 pt-9 sm:px-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-10">
          {trailer && <section id="trailer"><h2 className="mb-4 text-xl font-semibold text-white">Trailers & clips</h2><VideoPlayer videoKey={trailer.key} title={movie.title} fallbackUrl={`https://www.youtube.com/watch?v=${encodeURIComponent(trailer.key)}`} /></section>}
          {cast.length > 0 && <section><h2 className="mb-5 text-xl font-semibold text-white">Cast</h2><div className="flex gap-5 overflow-x-auto pb-3">{cast.map((person) => {
            const image = tmdbImage(person.profile_path, "w185");
            return <div key={person.id} className="w-24 shrink-0 text-center"><div className="relative mx-auto mb-3 size-20 overflow-hidden rounded-full border border-white/10 bg-white/5">{image && <Image src={image} alt={person.name} fill sizes="80px" className="object-cover" />}</div><p className="line-clamp-2 text-xs font-semibold text-slate-100">{person.name}</p><p className="mt-1 line-clamp-2 text-[10px] leading-4 text-slate-400">{person.character}</p></div>;
          })}</div></section>}
        </div>
        <aside className="space-y-4">
          <WatchOptions options={watchOptions} />
          <div className="glass rounded-2xl p-4 text-xs leading-5 text-slate-400">Movie information and images from TMDB. This product uses the TMDB API but is not endorsed or certified by TMDB.</div>
        </aside>
      </div>
    </main>
  );
}
