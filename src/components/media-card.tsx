import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { tmdbImage, type TmdbMovie } from "@/lib/tmdb";

export function MediaCard({ movie }: { movie: TmdbMovie }) {
  const poster = tmdbImage(movie.poster_path, "w342");
  return (
    <Link href={`/movies/${movie.id}`} className="group block">
      <div className="poster-glow relative aspect-[2/3] overflow-hidden rounded-2xl border border-white/10 bg-slate-900">
        {poster ? (
          <Image src={poster} alt={`${movie.title} poster`} fill sizes="(max-width: 640px) 44vw, (max-width: 1024px) 25vw, 17vw" className="object-cover transition duration-500 group-hover:scale-[1.04]" />
        ) : (
          <div className="grid h-full place-items-center p-5 text-center text-sm text-slate-500">Poster unavailable</div>
        )}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/25 to-transparent p-3 pt-16">
          <div className="flex items-end justify-between gap-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[.15em] text-cyan-200">Movie</p>
              <h3 className="mt-1 line-clamp-2 text-sm font-semibold text-white">{movie.title}</h3>
            </div>
            <ArrowUpRight size={16} className="mb-0.5 shrink-0 text-white/60 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-white" />
          </div>
        </div>
      </div>
      <p className="mt-2 text-xs text-slate-400">{movie.release_date ? new Date(`${movie.release_date}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }) : "Date TBA"}</p>
    </Link>
  );
}
