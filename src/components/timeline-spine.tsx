"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Clock3 } from "lucide-react";
import { MediaArtwork } from "@/components/media-artwork";
import { ScrollRail } from "@/components/scroll-rail";

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

function monthIndex(date: Date) {
  return date.getFullYear() * 12 + date.getMonth();
}

function dateFromMonthIndex(index: number) {
  return new Date(Math.floor(index / 12), index % 12, 1);
}

function monthLabel(date: Date) {
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function dayLabel(item: TimelineItem) {
  if (!item.sortTimestamp || item.isApproximate) return item.displayDate;
  const date = new Date(item.sortTimestamp);
  return Number.isNaN(date.getTime()) ? item.displayDate : date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

function itemHref(item: TimelineItem) {
  const href = item.href ?? `/entities/${item.id}`;
  return href.startsWith("/") ? `${href}?returnTo=${encodeURIComponent("/timeline")}` : href;
}

export function TimelineSpine({ items }: { items: TimelineItem[] }) {
  const scheduled = items.filter((item) => item.sortTimestamp && Number.isFinite(Date.parse(item.sortTimestamp)));
  const unscheduled = items.filter((item) => !item.sortTimestamp);
  const scheduledByMonth = useMemo(() => {
    const groups = new Map<number, TimelineItem[]>();
    for (const item of scheduled) {
      const key = monthIndex(new Date(item.sortTimestamp!));
      groups.set(key, [...(groups.get(key) ?? []), item]);
    }
    for (const group of groups.values()) group.sort((a, b) => Date.parse(a.sortTimestamp!) - Date.parse(b.sortTimestamp!) || a.title.localeCompare(b.title));
    return groups;
  }, [scheduled]);
  const months = useMemo(() => [...scheduledByMonth.keys()].sort((a, b) => a - b), [scheduledByMonth]);
  const todayIndex = monthIndex(new Date());
  const initialPosition = Math.max(0, months.findIndex((index) => index >= todayIndex));
  const [position, setPosition] = useState<number | null>(null);
  const [mode, setMode] = useState<"timeline" | "calendar">("timeline");
  const safePosition = Math.max(0, Math.min(Math.max(0, months.length - 1), position ?? initialPosition));
  const selectedMonthIndex = months.length ? months[Math.round(safePosition)] : todayIndex;
  const currentMonth = dateFromMonthIndex(selectedMonthIndex);
  const caption = monthLabel(currentMonth);
  const totalMonths = Math.max(1, months.length);

  function moveTo(next: number) {
    setPosition(Math.max(0, Math.min(Math.max(0, months.length - 1), next)));
  }

  function renderTimelineMonth(index: number) {
    const entries = scheduledByMonth.get(index) ?? [];
    const month = dateFromMonthIndex(index);
    return <section key={index} aria-label={`${monthLabel(month)} timeline`} style={{ flex: `0 0 ${100 / totalMonths}%`, minWidth: 0 }} className="relative h-[340px] px-5 pb-8 pt-6 sm:px-8">
      <div className="absolute inset-x-7 bottom-5 h-px bg-white/25 sm:inset-x-12" />
      <ScrollRail label={`${monthLabel(month)} releases`} trackClassName="timeline-card-track">
        {entries.map((item) => <div key={item.id} className="relative z-10 flex w-[142px] shrink-0 flex-col items-center justify-end">
          <Link href={itemHref(item)} aria-label={`${item.title}, ${dayLabel(item)}`} title={item.title} className="relative block h-[198px] w-[132px] overflow-hidden rounded-xl border border-white/10 bg-slate-950 shadow-lg shadow-black/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80">
            <MediaArtwork title={item.title} type={item.type} imageUrl={item.posterUrl} />
          </Link>
          <p className="mt-2 w-full truncate text-center text-xs font-semibold text-white" title={item.title}>{item.title}</p>
          <p className="relative mt-1 pb-6 text-center text-xs font-medium text-white/80 after:absolute after:left-1/2 after:top-4 after:h-9 after:w-[2px] after:-translate-x-1/2 after:bg-cyan-200/80">{dayLabel(item)}</p>
          <span aria-hidden="true" className="absolute -bottom-[6px] z-10 size-3 rounded-full border-2 border-slate-950 bg-cyan-200 shadow-[0_0_18px_rgba(103,232,249,.6)]" />
        </div>)}
      </ScrollRail>
    </section>;
  }

  const monthDays = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
  const startOffset = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay();
  const itemsInSelectedMonth = scheduledByMonth.get(selectedMonthIndex) ?? [];
  const byDay = new Map<number, TimelineItem[]>();
  for (const item of itemsInSelectedMonth) {
    const day = new Date(item.sortTimestamp!).getDate();
    byDay.set(day, [...(byDay.get(day) ?? []), item]);
  }

  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => moveTo(Math.round(safePosition) - 1)} disabled={!months.length || safePosition <= 0} aria-label="Previous month" className="glass grid size-10 place-items-center rounded-full text-lg text-white transition hover:bg-white/10 disabled:opacity-30">‹</button>
        <h2 className="min-w-40 text-lg font-semibold text-white sm:min-w-52 sm:text-2xl">{caption}</h2>
        <button type="button" onClick={() => moveTo(Math.round(safePosition) + 1)} disabled={!months.length || safePosition >= months.length - 1} aria-label="Next month" className="glass grid size-10 place-items-center rounded-full text-lg text-white transition hover:bg-white/10 disabled:opacity-30">›</button>
      </div>
      <div className="glass flex rounded-full p-1" role="group" aria-label="Timeline display">
        <button type="button" aria-pressed={mode === "timeline"} onClick={() => setMode("timeline")} className={`rounded-full px-4 py-2 text-sm transition ${mode === "timeline" ? "bg-white/15 text-white" : "text-white/75 hover:text-white"}`}>Timeline</button>
        <button type="button" aria-pressed={mode === "calendar"} onClick={() => setMode("calendar")} className={`rounded-full px-4 py-2 text-sm transition ${mode === "calendar" ? "bg-white/15 text-white" : "text-white/75 hover:text-white"}`}>Calendar</button>
      </div>
    </div>

    {months.length === 0 ? <div className="glass grid min-h-[260px] place-items-center rounded-[1.75rem] p-8 text-center">
      <div><span className="mx-auto grid size-12 place-items-center rounded-full border border-white/15 bg-white/[.06] text-cyan-100"><Clock3 size={20} /></span><h3 className="mt-4 text-lg font-medium text-white">Your timeline is ready</h3><p className="mt-2 max-w-md text-sm leading-6 text-white/75">Add a release with a confirmed date to see it here. Your saved items without a date will appear below.</p></div>
    </div> : mode === "timeline" ? <>
      <div className="glass overflow-hidden rounded-[1.75rem]" aria-label="Monthly release timeline">
        <div className="flex transition-transform duration-500 ease-[cubic-bezier(.22,1,.36,1)]" style={{ width: `${totalMonths * 100}%`, transform: `translate3d(-${safePosition / totalMonths * 100}%, 0, 0)` }}>
          {months.map(renderTimelineMonth)}
        </div>
      </div>
      {months.length > 1 && <p className="text-center text-xs text-white/60">Month {Math.round(safePosition) + 1} of {months.length} · Use the month arrows to browse releases</p>}
    </> : <div className="glass rounded-[1.75rem] p-4 sm:p-7">
      <div className="mb-3 grid grid-cols-7 text-center text-[10px] font-semibold uppercase tracking-[.15em] text-white/75 sm:text-xs">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <span key={day} className="py-2">{day}</span>)}</div>
      <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
        {Array.from({ length: startOffset }, (_, index) => <div key={`blank-${index}`} aria-hidden="true" className="min-h-24 rounded-xl sm:min-h-32" />)}
        {Array.from({ length: monthDays }, (_, index) => {
          const day = index + 1;
          const dayItems = byDay.get(day) ?? [];
          return <div key={day} className={`min-h-24 rounded-xl border p-1.5 sm:min-h-32 sm:p-2 ${dayItems.length ? "border-white/20 bg-white/[.08]" : "border-white/[.08] bg-black/[.1]"}`}>
            <p className="text-[10px] text-white/75 sm:text-xs">{day}</p>
            <div className="mt-1.5 flex flex-wrap gap-1">{dayItems.map((item) => <Link key={item.id} href={itemHref(item)} title={`${item.title} · ${item.displayDate}`} aria-label={`${item.title}, ${item.displayDate}`} className="relative size-7 overflow-hidden rounded-md border border-white/15 bg-slate-950 sm:size-10 sm:rounded-lg"><MediaArtwork title={item.title} type={item.type} imageUrl={item.posterUrl} /></Link>)}</div>
          </div>;
        })}
      </div>
    </div>}

    {unscheduled.length > 0 && <section>
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-[.15em] text-white/85">Date to be announced</h2>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4 xl:grid-cols-5">
        {unscheduled.map((item) => <Link key={item.id} href={itemHref(item)} aria-label={`${item.title} · ${item.displayDate}`} title={item.title} className={`group relative ${item.type === "MUSIC" ? "aspect-square" : "aspect-[2/3]"} overflow-hidden rounded-2xl border border-white/10 bg-slate-950`}>
          <MediaArtwork title={item.title} type={item.type} imageUrl={item.posterUrl} />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/15 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-3 text-center"><p className="line-clamp-2 text-xs font-semibold text-white sm:text-sm">{item.title}</p><p className="mt-1 text-[10px] text-white/80">{item.displayDate}</p></div>
        </Link>)}
      </div>
    </section>}
  </div>;
}
