import Link from "next/link";
import type { RadarItem } from "@/lib/radar";
import { MediaArtwork } from "@/components/media-artwork";

const kind: Record<RadarItem["type"], { label: string; tone: string; glow: string }> = {
  MOVIE: { label: "Movie", tone: "text-cyan-200", glow: "group-hover:shadow-cyan-500/20" },
  SHOW: { label: "TV", tone: "text-cyan-200", glow: "group-hover:shadow-cyan-500/20" },
  GAME: { label: "Game", tone: "text-violet-200", glow: "group-hover:shadow-violet-500/20" },
  MUSIC: { label: "Music", tone: "text-amber-200", glow: "group-hover:shadow-amber-500/20" },
};

export function RadarCard({ item }: { item: RadarItem }) {
  const color = kind[item.type];
  const card = (
    <>
      <div className={`poster-glow relative aspect-[2/3] overflow-hidden rounded-2xl border border-white/10 bg-slate-950 shadow-xl transition group-hover:-translate-y-1 ${color.glow}`}>
        <MediaArtwork title={item.title} type={item.type} imageUrl={item.posterUrl} fallbackUrls={item.posterFallbackUrls} className="transition duration-500 group-hover:scale-[1.04]" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/15 to-black/5" />
        <div className="absolute inset-x-0 bottom-0 p-3 pt-16">
          <p className={`text-[10px] font-semibold uppercase tracking-[.15em] ${color.tone}`}>{color.label}</p>
          <h3 className="mt-1 line-clamp-2 text-sm font-semibold leading-5 text-white">{item.title}</h3>
          <span aria-hidden className="absolute bottom-4 right-3 text-white/60 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5">↗</span>
        </div>
      </div>
      <p className="mt-2 min-h-8 text-xs leading-4 text-slate-400"><span className="line-clamp-2">{item.displayDate}</span></p>
    </>
  );

  return (
    <article>
      <div className="group">
        {item.href.startsWith("/") ? (
          <Link href={item.href} aria-label={`${item.title}, ${item.displayDate}`} className="block">{card}</Link>
        ) : (
          <a href={item.href} target="_blank" rel="noreferrer" aria-label={`Open ${item.title} source`} className="block">{card}</a>
        )}
      </div>
    </article>
  );
}
