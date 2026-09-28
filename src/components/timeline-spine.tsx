"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, HelpCircle, Waypoints } from "lucide-react";
import clsx from "clsx";

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

const palette: Record<TimelineItem["type"], { label: string; dot: string; glow: string }> = {
  MOVIE: { label: "Film", dot: "bg-cyan-300", glow: "shadow-cyan-400/15" },
  SHOW: { label: "TV", dot: "bg-cyan-300", glow: "shadow-cyan-400/15" },
  GAME: { label: "Game", dot: "bg-violet-300", glow: "shadow-violet-400/15" },
  MUSIC: { label: "Music", dot: "bg-amber-300", glow: "shadow-amber-400/15" },
  EVENT: { label: "Event", dot: "bg-fuchsia-300", glow: "shadow-fuchsia-400/15" },
};

function monthKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function CalendarView({ items }: { items: TimelineItem[] }) {
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const offset = new Date(year, monthIndex, 1).getDay();
  const days = new Date(year, monthIndex + 1, 0).getDate();
  const cells = Array.from({ length: Math.ceil((offset + days) / 7) * 7 }, (_, i) => i - offset + 1);
  const monthItems = items.filter((item) => item.sortTimestamp && (() => {
    const date = new Date(item.sortTimestamp);
    return date.getFullYear() === year && date.getMonth() === monthIndex;
  })());

  return (
    <section className="glass rounded-3xl p-4 sm:p-7">
      <div className="mb-5 flex items-center justify-between gap-3">
        <button type="button" onClick={() => setMonth(new Date(year, monthIndex - 1, 1))} aria-label="Previous month" className="grid size-9 place-items-center rounded-full border border-white/10 text-slate-300 hover:bg-white/10"><ChevronLeft size={16} /></button>
        <h2 className="text-base font-semibold text-white sm:text-lg">{month.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</h2>
        <button type="button" onClick={() => setMonth(new Date(year, monthIndex + 1, 1))} aria-label="Next month" className="grid size-9 place-items-center rounded-full border border-white/10 text-slate-300 hover:bg-white/10"><ChevronRight size={16} /></button>
      </div>
      <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <p key={day} className="pb-1 text-center text-[10px] font-semibold uppercase tracking-wider text-slate-500">{day}</p>)}
        {cells.map((day, index) => {
          const inMonth = day >= 1 && day <= days;
          const dayItems = inMonth ? monthItems.filter((item) => new Date(item.sortTimestamp!).getDate() === day) : [];
          return (
            <div key={index} className={`min-h-[84px] rounded-xl border p-1.5 sm:min-h-[116px] sm:p-2 ${inMonth ? "border-white/[.07] bg-white/[.025]" : "border-transparent opacity-30"}`}>
              <span className={`text-[11px] ${day === new Date().getDate() && monthIndex === new Date().getMonth() && year === new Date().getFullYear() ? "grid size-6 place-items-center rounded-full bg-cyan-200 text-slate-950" : "text-slate-500"}`}>{inMonth ? day : ""}</span>
              <div className="mt-1 space-y-1">
                {dayItems.slice(0, 2).map((item) => <Link key={item.id} href={item.href ?? `/entities/${item.id}`} title={`${item.title} · ${item.displayDate}`} className="block truncate rounded-md bg-white/[.06] px-1.5 py-1 text-[9px] leading-3 text-slate-200 hover:bg-white/10 sm:text-[10px]">{item.title}</Link>)}
                {dayItems.length > 2 && <p className="px-1 text-[9px] text-slate-500">+{dayItems.length - 2} more</p>}
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-4 text-xs text-slate-500">{monthItems.length ? `${monthItems.length} tracked release${monthItems.length === 1 ? "" : "s"} this month` : "No dated releases in this month. Try another month or browse Discover."}</p>
    </section>
  );
}

export function TimelineSpine({ items }: { items: TimelineItem[] }) {
  const [view, setView] = useState<"timeline" | "calendar">("timeline");
  const timeline = useMemo(() => {
    const today = new Date();
    const start = new Date(today);
    start.setUTCHours(0, 0, 0, 0);
    const scheduled = items.filter((item) => item.sortTimestamp && Number.isFinite(Date.parse(item.sortTimestamp)))
      .slice().sort((a, b) => Date.parse(a.sortTimestamp!) - Date.parse(b.sortTimestamp!));
    const minimumEnd = start.getTime() + 90 * 86_400_000;
    const farthest = scheduled.reduce((max, item) => {
      const itemEnd = item.dateEnd ? Date.parse(item.dateEnd) : Date.parse(item.sortTimestamp!);
      return Math.max(max, Number.isFinite(itemEnd) ? itemEnd : 0);
    }, minimumEnd);
    const end = new Date(farthest);
    const range = Math.max(end.getTime() - start.getTime(), 1);
    const monthCount = Math.max(3, (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + end.getUTCMonth() - start.getUTCMonth() + 1);
    const width = Math.max(980, monthCount * 170);
    const grouped = new Map<string, { month: Date; type: TimelineItem["type"]; items: TimelineItem[] }>();
    for (const item of scheduled) {
      const date = new Date(item.sortTimestamp!);
      const key = `${monthKey(date)}:${item.type}`;
      const existing = grouped.get(key);
      if (existing) existing.items.push(item);
      else grouped.set(key, { month: date, type: item.type, items: [item] });
    }
    const groups = [...grouped.values()].sort((a, b) => a.month.getTime() - b.month.getTime() || a.type.localeCompare(b.type));
    const ticks: Date[] = [];
    for (let cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1)); cursor < end; cursor.setUTCMonth(cursor.getUTCMonth() + 1)) ticks.push(new Date(cursor));
    return { start, end, range, width, groups, ticks, unscheduled: items.filter((item) => !item.sortTimestamp) };
  }, [items]);

  const daysBetween = Math.max(1, Math.round((timeline.end.getTime() - timeline.start.getTime()) / 86_400_000));

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <div className="flex rounded-full border border-white/10 bg-white/[.03] p-1" role="group" aria-label="Timeline view">
          <button type="button" onClick={() => setView("timeline")} aria-pressed={view === "timeline"} className={`inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-medium transition ${view === "timeline" ? "bg-white/10 text-white" : "text-slate-400 hover:text-white"}`}><Waypoints size={14} /> Timeline</button>
          <button type="button" onClick={() => setView("calendar")} aria-pressed={view === "calendar"} className={`inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-medium transition ${view === "calendar" ? "bg-white/10 text-white" : "text-slate-400 hover:text-white"}`}><CalendarDays size={14} /> Calendar</button>
        </div>
      </div>

      {view === "calendar" ? (
        <CalendarView items={items} />
      ) : (
        <div className="glass overflow-x-auto rounded-3xl p-5 sm:p-8">
          <div className="relative h-[490px]" style={{ minWidth: timeline.width }}>
            <div className="absolute top-[238px] right-0 left-0 h-px bg-gradient-to-r from-transparent via-white/35 to-transparent" />
            {timeline.ticks.map((tick) => {
              const left = ((tick.getTime() - timeline.start.getTime()) / timeline.range) * 100;
              return <div key={monthKey(tick)} className="absolute top-[226px] h-6" style={{ left: `${left}%` }}><span className="absolute h-6 w-px bg-white/25" /><span className="absolute top-8 -translate-x-1/2 whitespace-nowrap text-[10px] font-medium uppercase tracking-[.16em] text-slate-500">{tick.toLocaleDateString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" })}</span></div>;
            })}
            {timeline.groups.map((group, index) => {
              const x = ((group.month.getTime() - timeline.start.getTime()) / timeline.range) * 100;
              const above = index % 2 === 0;
              const colors = palette[group.type];
              return (
                <motion.div key={`${monthKey(group.month)}:${group.type}`} initial={{ opacity: 0, y: above ? 8 : -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: Math.min(index * 0.025, 0.35) }} className="absolute w-[min(270px,80vw)] -translate-x-1/2" style={{ left: `${x}%`, top: above ? 0 : 270 }}>
                  <div className={clsx("glass rounded-2xl p-3 shadow-xl", colors.glow)}>
                    <div className="mb-2 flex items-center justify-between gap-2"><span className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.15em] text-slate-300"><span className={clsx("size-1.5 rounded-full", colors.dot)} />{colors.label} · {group.month.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" })}</span>{group.items.length > 1 && <span className="text-[10px] text-slate-500">{group.items.length} releases</span>}</div>
                    <div className="space-y-2">{group.items.slice(0, 4).map((item) => <Link key={item.id} href={item.href ?? `/entities/${item.id}`} className="block truncate rounded-xl bg-black/20 px-3 py-2 text-sm text-white transition hover:bg-white/10"><span className="mr-2 text-[11px] text-slate-400">{item.displayDate}</span>{item.title}{item.isApproximate && <span className="ml-2 text-[10px] text-slate-500">approx.</span>}</Link>)}{group.items.length > 4 && <p className="px-3 text-xs text-slate-400">+{group.items.length - 4} more tracked</p>}</div>
                  </div>
                  <span className={clsx("mx-auto block w-px bg-white/25", above ? "h-[222px]" : "absolute -top-[32px] left-1/2 h-[32px]")} />
                  <span className={clsx("absolute left-1/2 size-3 -translate-x-1/2 rounded-full border-2 border-[#0b0e14]", colors.dot, above ? "top-[232px]" : "-top-[38px]")} />
                </motion.div>
              );
            })}
            <span className="absolute top-[213px] left-0 rounded-full bg-[#0b0e14] px-2 py-1 text-[10px] uppercase tracking-wider text-slate-500">Today</span>
            <span className="absolute top-[213px] right-0 rounded-full bg-[#0b0e14] px-2 py-1 text-[10px] uppercase tracking-wider text-slate-500">+{daysBetween} days</span>
            {timeline.groups.length === 0 && <div className="absolute inset-x-0 top-[188px] text-center"><Clock3 className="mx-auto mb-3 text-cyan-200/70" size={21} /><p className="text-sm text-slate-400">Your horizon is open. Releases you add will appear along this line.</p></div>}
          </div>
        </div>
      )}

      {view === "timeline" && <section className="glass rounded-3xl p-5 sm:p-7"><div className="mb-4 flex items-center gap-2"><HelpCircle size={17} className="text-slate-400" /><h2 className="text-sm font-semibold text-white">Unscheduled Horizon</h2><span className="text-xs text-slate-500">{timeline.unscheduled.length}</span></div>{timeline.unscheduled.length === 0 ? <p className="text-sm text-slate-500">No TBA releases right now.</p> : <div className="flex flex-wrap gap-2">{timeline.unscheduled.map((item) => <Link key={item.id} href={item.href ?? `/entities/${item.id}`} className="glass rounded-full px-4 py-2 text-sm text-slate-200 transition hover:bg-white/10">{item.title}<span className="ml-1 text-xs text-slate-500">· TBA</span></Link>)}</div>}</section>}
    </div>
  );
}
