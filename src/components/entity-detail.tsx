import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, CalendarDays, ExternalLink } from "lucide-react";
import type { Entity, EntityCredit, EntityMedia, EventDetail } from "@/generated/prisma/client";
import { NewsPanel } from "@/components/news-panel";

type EntityWithDetails = Entity & {
  credits: EntityCredit[];
  media: EntityMedia[];
  eventDates: EventDetail[];
};

const kindLabel: Record<EntityWithDetails["type"], string> = {
  MOVIE: "Movie", SHOW: "TV", GAME: "Game", MUSIC: "Music", EVENT: "Event",
};

const confidencePercent: Record<EntityWithDetails["confidenceLevel"], number> = {
  OFFICIAL: 100,
  CREDIBLE_LEAK: 75,
  INDUSTRY_RUMOR: 40,
  SPECULATIVE: 15,
};

export function EntityDetail({ entity }: { entity: EntityWithDetails }) {
  return (
    <main className="min-h-screen pb-32">
      <section className="relative min-h-[380px] overflow-hidden border-b border-white/10 sm:min-h-[470px]">
        {entity.backdropUrl && <Image src={entity.backdropUrl} alt="" fill priority sizes="100vw" className="object-cover opacity-40" />}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0b0e14] via-[#0b0e14]/65 to-[#0b0e14]/20" />
        <div className="relative mx-auto flex min-h-[380px] max-w-7xl flex-col justify-end px-5 pb-9 pt-10 sm:min-h-[470px] sm:px-8 sm:pb-14">
          <Link href="/timeline" className="absolute top-8 inline-flex items-center gap-2 text-sm text-slate-300 hover:text-white"><ArrowLeft size={15} /> Timeline</Link>
          <p className="mb-3 text-xs font-semibold uppercase tracking-[.2em] text-cyan-200">{kindLabel[entity.type]} · {confidencePercent[entity.confidenceLevel]}% confidence</p>
          <h1 className="max-w-4xl text-4xl font-semibold tracking-tight text-white sm:text-6xl">{entity.title}</h1>
          <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-slate-300">
            <span className="flex items-center gap-2"><CalendarDays size={15} />{entity.displayDate}</span>
            {entity.externalUrl && <a href={entity.externalUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-white">Official source <ExternalLink size={13} /></a>}
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-7xl gap-8 px-5 pt-9 sm:px-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-8">
          {entity.description && <p className="max-w-3xl text-sm leading-7 text-slate-300">{entity.description}</p>}
          {entity.credits.length > 0 && <section><h2 className="mb-4 text-lg font-semibold text-white">Cast &amp; creators</h2><div className="flex gap-4 overflow-x-auto pb-2">{entity.credits.map((credit) => <div key={credit.id} className="w-20 shrink-0 text-center"><div className="relative mx-auto mb-2 size-16 overflow-hidden rounded-full border border-white/10 bg-white/5">{credit.imageUrl && <Image src={credit.imageUrl} alt={credit.name} fill sizes="64px" className="object-cover" />}</div><p className="line-clamp-2 text-xs font-medium text-slate-200">{credit.name}</p><p className="mt-0.5 line-clamp-2 text-[10px] text-slate-500">{credit.characterName ?? credit.role.toLowerCase().replaceAll("_", " ")}</p></div>)}</div></section>}
          {entity.eventDates.length > 0 && <section><h2 className="mb-4 text-lg font-semibold text-white">Dates &amp; venues</h2><div className="space-y-2">{entity.eventDates.map((event) => <div key={event.id} className="glass flex flex-wrap justify-between gap-2 rounded-xl p-4 text-sm"><span className="text-white">{event.venue ?? event.city ?? "Venue TBA"}{event.city && event.venue ? ` · ${event.city}` : ""}</span><span className="text-slate-400">{event.eventTime?.toLocaleString() ?? "Time TBA"}</span></div>)}</div></section>}
          {entity.media.length > 0 && <section><h2 className="mb-4 text-lg font-semibold text-white">Links &amp; videos</h2><div className="grid gap-2 sm:grid-cols-2">{entity.media.map((media) => <a key={media.id} href={media.url} target="_blank" rel="noreferrer" className="glass flex items-center justify-between rounded-xl p-4 text-sm text-slate-200 hover:bg-white/10"><span>{media.title ?? media.provider ?? media.kind.toLowerCase().replaceAll("_", " ")}</span><ExternalLink size={14} className="text-slate-500" /></a>)}</div></section>}
        </div>
        <NewsPanel title={entity.title} />
      </div>
    </main>
  );
}
