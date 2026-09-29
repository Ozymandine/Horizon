import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AddToTimelineButton } from "@/components/add-to-timeline-button";
import { MediaArtwork } from "@/components/media-artwork";
import { NewsPanel } from "@/components/news-panel";
import { getUpcomingRadar, type RadarItem } from "@/lib/radar";

const labels: Record<RadarItem["type"], string> = { MOVIE: "Movie", SHOW: "Series", GAME: "Game", MUSIC: "Music" };

export default async function ReleaseDetailPage({ params }: { params: Promise<{ source: string; id: string }> }) {
  const { source, id } = await params;
  const feed = await getUpcomingRadar();
  const item = Object.values(feed).flat().find((release) => release.source === source && release.sourceId === id);
  if (!item) notFound();

  return (
    <main className="min-h-screen px-5 pb-32 pt-8 sm:px-8 sm:pt-12">
      <div className="mx-auto max-w-6xl">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-slate-300 hover:text-white"><span aria-hidden="true">←</span> Upcoming</Link>
        <section className="relative mt-6 grid min-h-[440px] overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950 lg:grid-cols-[minmax(0,1fr)_320px]">
          {item.backdropUrl && <Image src={item.backdropUrl} alt="" fill priority sizes="100vw" className="object-cover opacity-25" />}
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/90 to-slate-950/50" />
          <div className="relative flex flex-col justify-end p-7 sm:p-11">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[.2em] text-slate-300">{labels[item.type]}</p>
            <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-white sm:text-6xl">{item.title}</h1>
            <p className="mt-3 text-sm font-medium text-cyan-100/85">{item.displayDate}</p>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-slate-300">{item.description || "Release details will be added as they become available."}</p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <AddToTimelineButton item={item} />
              {item.externalUrl && <a href={item.externalUrl} target="_blank" rel="noreferrer" className="detail-action">Open official listing <span aria-hidden="true">↗</span></a>}
            </div>
          </div>
          <div className="relative hidden min-h-[440px] p-8 lg:block">
            <div className="absolute inset-8 overflow-hidden rounded-2xl shadow-2xl">
              <MediaArtwork title={item.title} type={item.type} imageUrl={item.posterUrl} fallbackUrls={item.posterFallbackUrls} />
            </div>
            <div className="absolute inset-8 rounded-2xl bg-gradient-to-t from-black/55 via-transparent to-transparent" />
          </div>
        </section>
        <div className="mt-8 max-w-2xl"><NewsPanel title={item.title} /></div>
      </div>
    </main>
  );
}
