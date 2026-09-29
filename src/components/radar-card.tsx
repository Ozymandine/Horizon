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
  if (item.releaseDate) {
    const date = new Date(`${item.releaseDate}T12:00:00Z`);
    if (Number.isFinite(date.getTime())) return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  }
  return item.displayDate;
}

export function RadarCard({ item, returnTo }: { item: RadarItem; returnTo?: string }) {
  const card = <div className={`group relative aspect-[2/3] w-full overflow-hidden rounded-[1.25rem] border border-white/10 bg-slate-950 shadow-xl shadow-black/25 transition duration-300 hover:-translate-y-1 ${glow[item.type]}`}>
    <MediaArtwork title={item.title} type={item.type} imageUrl={item.posterUrl} fallbackUrls={item.posterFallbackUrls} className="transition duration-500 group-hover:scale-[1.035] group-focus-visible:scale-[1.035]" />
    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/95 via-black/10 to-black/5 opacity-0 transition duration-300 group-hover:opacity-100 group-focus-visible:opacity-100" />
    <span aria-hidden="true" className="pointer-events-none absolute left-1/2 top-[43%] grid size-12 -translate-x-1/2 -translate-y-1/2 scale-90 place-items-center rounded-full bg-white text-lg text-black opacity-0 shadow-xl transition duration-300 group-hover:scale-100 group-hover:opacity-100 group-focus-visible:scale-100 group-focus-visible:opacity-100">▶</span>
    <div className="pointer-events-none absolute inset-x-0 bottom-0 translate-y-2 p-4 opacity-0 transition duration-300 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100">
      <h3 className="line-clamp-2 text-base font-semibold leading-5 text-white sm:text-lg">{item.title}</h3>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 text-xs text-white/80">
        <span>{dateLabel(item)}</span>
        {item.voteAverage && item.voteAverage > 0 ? <span className="inline-flex items-center gap-1 text-amber-200"><span aria-hidden="true">★</span>{item.voteAverage.toFixed(1)}</span> : null}
      </div>
    </div>
    <span className="sr-only">{item.title}. {dateLabel(item)}{item.voteAverage ? `. Rated ${item.voteAverage.toFixed(1)}` : ""}</span>
  </div>;

  return <article>
    {item.href.startsWith("/")
      ? <Link href={detailHref(item, returnTo)} aria-label={`Open ${item.title}`} className="block rounded-[1.25rem] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70">{card}</Link>
      : <a href={item.href} target="_blank" rel="noreferrer" aria-label={`Open ${item.title} source`} className="block rounded-[1.25rem] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70">{card}</a>}
  </article>;
}
