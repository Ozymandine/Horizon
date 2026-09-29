"use client";

import { AnimatePresence, motion } from "framer-motion";
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

function monthIndex(date: Date) {
  return date.getFullYear() * 12 + date.getMonth();
}

function dateFromMonthIndex(index: number) {
  return new Date(Math.floor(index / 12), index % 12, 1);
}

function getMonthLabel(date: Date) {
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function dayLabel(item: TimelineItem) {
  if (!item.sortTimestamp) return item.displayDate;
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
  const nowIndex = monthIndex(new Date());
  const bounds = useMemo(() => {
    const indices = scheduled.map((item) => monthIndex(new Date(item.sortTimestamp!)));
    return { min: indices.length ? Math.min(nowIndex, ...indices) : nowIndex, max: indices.length ? Math.max(nowIndex, ...indices) : nowIndex };
  }, [nowIndex, scheduled]);
  const firstReleaseMonth = scheduled.map((item) => monthIndex(new Date(item.sortTimestamp!))).sort((a, b) => a - b)[0];
  const [selectedMonth, setSelectedMonth] = useState(firstReleaseMonth ?? nowIndex);
  const [mode, setMode] = useState<"timeline" | "calendar">("timeline");
  const [direction, setDirection] = useState(1);
  const month = dateFromMonthIndex(selectedMonth);
  const caption = getMonthLabel(month);
  const visible = scheduled.filter((item) => monthIndex(new Date(item.sortTimestamp!)) === selectedMonth)
    .sort((a, b) => Date.parse(a.sortTimestamp!) - Date.parse(b.sortTimestamp!) || a.title.localeCompare(b.title));
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const startOffset = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
  const byDay = new Map<number, TimelineItem[]>();
  for (const item of visible) {
    const day = new Date(item.sortTimestamp!).getDate();
    byDay.set(day, [...(byDay.get(day) ?? []), item]);
  }

  function setMonthWithDirection(next: number) {
    setDirection(next >= selectedMonth ? 1 : -1);
    setSelectedMonth(Math.min(bounds.max, Math.max(bounds.min, next)));
  }

  const monthView = <motion.div key={`${selectedMonth}-${mode}`} initial={{ opacity: 0, x: direction * 34 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: direction * -34 }} transition={{ duration: 0.28, ease: "easeOut" }}>
    {mode === "timeline" ? <div className="glass overflow-hidden rounded-[1.75rem] p-5 sm:p-8">
      {visible.length ? <div className="overflow-x-auto pb-3">
        <div className="relative grid min-w-full gap-x-4" style={{ gridTemplateColumns: `repeat(${visible.length}, minmax(125px, 1fr))`, minWidth: `${Math.max(100, visible.length * 155)}px` }}>
          <div aria-hidden="true" className="absolute inset-x-0 bottom-[11px] h-px bg-white/20" />
          {visible.map((item) => <div key={item.id} className="relative z-10 flex flex-col items-center">
            <Link href={itemHref(item)} aria-label={`${item.title}, ${dayLabel(item)}`} title={item.title} className="group relative mb-3 block aspect-[2/3] w-full max-w-[175px] overflow-hidden rounded-2xl border border-white/10 bg-slate-950 shadow-lg shadow-black/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/70">
              <MediaArtwork title={item.title} type={item.type} imageUrl={item.posterUrl} />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100" />
              <p className="absolute inset-x-0 bottom-0 translate-y-2 p-3 text-center text-xs font-semibold leading-4 text-white opacity-0 transition group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100">{item.title}</p>
            </Link>
            <p className="min-h-5 text-center text-xs font-medium text-slate-300">{dayLabel(item)}</p>
            <span aria-hidden="true" className="relative z-10 mt-3 size-3 rounded-full border-2 border-slate-950 bg-cyan-200 shadow-[0_0_18px_rgba(103,232,249,.6)]" />
          </div>)}
        </div>
      </div> : <div className="flex min-h-[360px] items-center justify-center text-center text-sm text-slate-400">No saved releases in {caption}.</div>}
    </div> : <div className="glass rounded-[1.75rem] p-4 sm:p-7">
      <div className="mb-3 grid grid-cols-7 text-center text-[10px] font-semibold uppercase tracking-[.15em] text-slate-500 sm:text-xs">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <span key={day} className="py-2">{day}</span>)}</div>
      <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
        {Array.from({ length: startOffset }, (_, index) => <div key={`blank-${index}`} aria-hidden="true" className="min-h-24 rounded-xl sm:min-h-32" />)}
        {Array.from({ length: daysInMonth }, (_, index) => {
          const day = index + 1;
          const dayItems = byDay.get(day) ?? [];
          return <div key={day} className={`min-h-24 rounded-xl border p-1.5 sm:min-h-32 sm:p-2 ${dayItems.length ? "border-white/15 bg-white/[.07]" : "border-white/[.05] bg-black/[.08]"}`}>
            <p className="text-[10px] text-slate-500 sm:text-xs">{day}</p>
            <div className="mt-1.5 flex flex-wrap gap-1">{dayItems.map((item) => <Link key={item.id} href={itemHref(item)} title={`${item.title} · ${item.displayDate}`} aria-label={`${item.title}, ${item.displayDate}`} className="relative size-7 overflow-hidden rounded-md border border-white/10 bg-slate-950 sm:size-10 sm:rounded-lg"><MediaArtwork title={item.title} type={item.type} imageUrl={item.posterUrl} /></Link>)}</div>
          </div>;
        })}
      </div>
    </div>}
  </motion.div>;

  return <div className="space-y-8">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => setMonthWithDirection(selectedMonth - 1)} disabled={selectedMonth <= bounds.min} aria-label="Previous month" className="glass grid size-10 place-items-center rounded-full text-lg text-slate-200 transition hover:bg-white/10 disabled:opacity-30">‹</button>
        <h2 className="min-w-40 text-lg font-semibold text-white sm:min-w-52 sm:text-2xl">{caption}</h2>
        <button type="button" onClick={() => setMonthWithDirection(selectedMonth + 1)} disabled={selectedMonth >= bounds.max} aria-label="Next month" className="glass grid size-10 place-items-center rounded-full text-lg text-slate-200 transition hover:bg-white/10 disabled:opacity-30">›</button>
      </div>
      <div className="glass flex rounded-full p-1" role="group" aria-label="Timeline display">
        <button type="button" aria-pressed={mode === "timeline"} onClick={() => setMode("timeline")} className={`rounded-full px-4 py-2 text-sm transition ${mode === "timeline" ? "bg-white/15 text-white" : "text-slate-400 hover:text-white"}`}>Timeline</button>
        <button type="button" aria-pressed={mode === "calendar"} onClick={() => setMode("calendar")} className={`rounded-full px-4 py-2 text-sm transition ${mode === "calendar" ? "bg-white/15 text-white" : "text-slate-400 hover:text-white"}`}>Calendar</button>
      </div>
    </div>
    {mode === "timeline" && bounds.max > bounds.min && <label className="glass flex items-center gap-4 rounded-full px-5 py-3 text-xs text-slate-400"><span>{getMonthLabel(dateFromMonthIndex(bounds.min))}</span><input type="range" min={bounds.min} max={bounds.max} value={selectedMonth} onChange={(event) => setMonthWithDirection(Number(event.target.value))} aria-label="Slide through months" className="h-1.5 flex-1 cursor-pointer accent-cyan-200" /><span>{getMonthLabel(dateFromMonthIndex(bounds.max))}</span></label>}
    <AnimatePresence mode="wait" initial={false}>{monthView}</AnimatePresence>
    {unscheduled.length > 0 && <section>
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-[.15em] text-slate-300">Unscheduled</h2>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4">
        {unscheduled.map((item) => <Link key={item.id} href={itemHref(item)} aria-label={`${item.title} · release date not announced`} title={item.title} className="group relative aspect-[2/3] overflow-hidden rounded-2xl border border-white/10 bg-slate-950"><MediaArtwork title={item.title} type={item.type} imageUrl={item.posterUrl} /><div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-0 transition group-hover:opacity-100" /><p className="absolute inset-x-0 bottom-0 p-3 text-center text-xs font-semibold text-white opacity-0 transition group-hover:opacity-100">{item.title}</p></Link>)}
      </div>
    </section>}
  </div>;
}
