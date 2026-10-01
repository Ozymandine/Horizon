import Link from "next/link";
import type { RadarItem } from "@/lib/radar";
import { MediaArtwork } from "@/components/media-artwork";

const glow: Record<RadarItem["type"], string> = {
  MOVIE: "hover:shadow-cyan-500/20 focus-visible:shadow-cyan-500/20",
  SHOW: "hover:shadow-cyan-500/20 focus-visible:shadow-cyan-500/20",
  GAME: "hover:shadow-violet-500/20 focus-visible:shadow-violet-500/20",
  MUSIC: "hover:shadow-amber-500/20 focus-visible:shadow-amber-500/20",
};

function detailHref(item: RadarItem, returnTo?: string) {
  if (!item.href.startsWith("/") || !returnTo) return item.href;
  const separator = item.href.includes("?") ? "&" : "?";
  return `${item.href}${separator}returnTo=${encodeURIComponent(returnTo)}`;
}

function dateLabel(item: RadarItem) {
  if (item.type === "MUSIC") return item.displayDate;
  if (item.releaseDate) {
    const date = new Date(`${item.releaseDate}T12:00:00Z`);
    if (Number.isFinite(date.getTime())) return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  }
  return item.displayDate;
}

function ratingLabel(item: RadarItem) {
  if (item.ratingLabel) return `${item.ratingSource ? `${item.ratingSource} · ` : ""}${item.ratingLabel}`;
  if (!item.voteAverage || item.voteAverage <= 0) return "";
  const scale = item.ratingScale ?? 10;
  const score = `${item.voteAverage.toFixed(1)}/${scale}`;
  const votes = item.voteCount ? ` · ${item.voteCount.toLocaleString()} votes` : "";
  return `${item.ratingSource ? `${item.ratingSource} · ` : ""}${score}${votes}`;
}

export function RadarCard({ item, returnTo, priority = false }: { item: RadarItem; returnTo?: string; priority?: boolean }) {
  const aspect = item.type === "MUSIC" ? "aspect-square" : item.type === "GAME" ? "aspect-[4/3]" : "aspect-[2/3]";
  const card = <div className={`group relative ${aspect} w-full overflow-hidden rounded-[1.25rem] border border-white/10 bg-slate-950 shadow-xl shadow-black/25 transition duration-300 hover:-translate-y-1 ${glow[item.type]}`}>
    <MediaArtwork title={item.title} type={item.type} imageUrl={item.posterUrl} fallbackUrls={item.posterFallbackUrls} priority={priority} className="transition duration-500 group-hover:scale-[1.035] group-focus-visible:scale-[1.035]" />
    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-black/15 to-transparent opacity-100 transition duration-300 group-hover:from-black/95" />
    <div className="pointer-events-none absolute inset-x-0 bottom-0 p-3 sm:p-4">
      <h3 className="line-clamp-2 text-sm font-semibold leading-5 text-white sm:text-base">{item.title}</h3>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 text-[11px] text-white/80 sm:text-xs">
        <span className="line-clamp-2">{dateLabel(item)}</span>
        {ratingLabel(item) ? <span className="inline-flex items-center gap-1 text-amber-100" title="Ratings and review labels are shown with their original source and scale">{item.voteAverage ? <span aria-hidden="true">★</span> : null}{ratingLabel(item)}</span> : null}
      </div>
    </div>
  </div>;

  return <article>
    {item.href.startsWith("/")
      ? <Link href={detailHref(item, returnTo)} aria-label={`Open ${item.title}`} className="block rounded-[1.25rem] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70">{card}</Link>
      : <a href={item.href} target="_blank" rel="noreferrer" aria-label={`Open ${item.title} source`} className="block rounded-[1.25rem] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70">{card}</a>}
  </article>;
}
