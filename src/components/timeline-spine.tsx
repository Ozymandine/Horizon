"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { MediaArtwork } from "@/components/media-artwork";

export type TimelineItem = {
  id: string;
  title: string;
  type: "MOVIE" | "SHOW" | "GAME" | "MUSIC" | "EVENT";
  displayDate: string;
  sortTimestamp: string | null;
  dateEnd?: string | null;
  isApproximate: boolean;
  confidenceLevel?: "OFFICIAL" | "CREDIBLE_LEAK" | "INDUSTRY_RUMOR" | "SPECULATIVE";
  posterUrl?: string | null;
  href?: string;
};

function monthFromDate(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}`;
}

export function TimelineSpine({ items }: { items: TimelineItem[] }) {
  const initialMonth = useMemo(() => {
    const today = new Date();
    const future = items.filter((item) => item.sortTimestamp)
      .map((item) => new Date(item.sortTimestamp!))
      .filter((date) => Number.isFinite(date.getTime()) && date >= new Date(today.getFullYear(), today.getMonth(), 1))
      .sort((a, b) => a.getTime() - b.getTime())[0];
    return monthFromDate(future ?? today);
  }, [items]);
  const [month, setMonth] = useState(initialMonth);
  const scheduled = items.filter((item) => item.sortTimestamp);
  const unscheduled = items.filter((item) => !item.sortTimestamp);
  const visible = scheduled.filter((item) => {
    const date = new Date(item.sortTimestamp!);
    return Number.isFinite(date.getTime()) && monthKey(date) === monthKey(month);
  }).sort((a, b) => Date.parse(a.sortTimestamp!) - Date.parse(b.sortTimestamp!) || a.title.localeCompare(b.title));
  const caption = month.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return (
    <div className="space-y-8">
      <section aria-label={`${caption} timeline releases`}>
        <div className="mb-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))} aria-label="Previous month" className="glass grid size-10 place-items-center rounded-full text-lg text-slate-200 transition hover:bg-white/10">‹</button>
            <div><p className="text-[10px] font-semibold uppercase tracking-[.2em] text-cyan-100/70">Release month</p><h2 className="mt-1 text-xl font-semibold text-white sm:text-2xl">{caption}</h2></div>
            <button type="button" onClick={() => setMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))} aria-label="Next month" className="glass grid size-10 place-items-center rounded-full text-lg text-slate-200 transition hover:bg-white/10">›</button>
          </div>
          <span className="hidden text-xs text-slate-500 sm:block">{visible.length} release{visible.length === 1 ? "" : "s"}</span>
        </div>

        {visible.length ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {visible.map((item) => (
              <Link key={item.id} href={item.href ?? `/entities/${item.id}`} aria-label={`${item.title} · ${item.displayDate}`} title={`${item.title} · ${item.displayDate}`} className="group relative aspect-[2/3] overflow-hidden rounded-2xl border border-white/10 bg-slate-950 shadow-lg shadow-black/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-100">
                <MediaArtwork title={item.title} type={item.type} imageUrl={item.posterUrl} />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent opacity-35 transition group-hover:opacity-100 group-focus-visible:opacity-100" />
                <div className="absolute inset-x-0 bottom-0 translate-y-3 p-3 opacity-0 transition group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100">
                  <p className="line-clamp-2 text-sm font-semibold leading-5 text-white">{item.title}</p>
                  <p className="mt-1 text-xs text-slate-200/80">{item.displayDate}</p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="glass rounded-3xl p-8 text-sm text-slate-400">No scheduled cards for {caption}. Browse another month or add a release from its details.</div>
        )}
      </section>

      {unscheduled.length > 0 && <section>
        <div className="mb-4 flex items-center gap-3"><h2 className="text-sm font-semibold text-white">Unscheduled</h2><span className="text-xs text-slate-500">{unscheduled.length}</span></div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {unscheduled.map((item) => <Link key={item.id} href={item.href ?? `/entities/${item.id}`} aria-label={`${item.title} · release date not announced`} className="group relative aspect-[2/3] overflow-hidden rounded-2xl border border-white/10 bg-slate-950"><MediaArtwork title={item.title} type={item.type} imageUrl={item.posterUrl} /><div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent opacity-35 transition group-hover:opacity-100" /><div className="absolute inset-x-0 bottom-0 translate-y-3 p-3 opacity-0 transition group-hover:translate-y-0 group-hover:opacity-100"><p className="line-clamp-2 text-sm font-semibold text-white">{item.title}</p><p className="mt-1 text-xs text-slate-200/80">Date TBA</p></div></Link>)}
        </div>
      </section>}
    </div>
  );
}
