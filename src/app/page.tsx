import { ArrowRight, CalendarDays, Sparkles } from "lucide-react";
import Link from "next/link";
import { RadarFeed } from "@/components/radar-feed";
import { getUpcomingRadar } from "@/lib/radar";

export default async function UpcomingPage() {
  const feed = await getUpcomingRadar();
  const all = Object.values(feed).flat().sort((a, b) => (a.sortTimestamp ?? "9999").localeCompare(b.sortTimestamp ?? "9999"));
  const nextRelease = all[0];

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-5 pb-32 pt-8 sm:px-8 sm:pt-12">
      <header className="mb-12 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-sm font-semibold tracking-[.18em] text-white">
          <span className="grid size-8 place-items-center rounded-xl bg-cyan-300/10 text-cyan-200"><Sparkles size={17} /></span>
          HORIZON
        </Link>
        <span className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/[.03] px-3 py-1.5 text-xs text-slate-400 sm:flex"><span className="size-1.5 rounded-full bg-emerald-300" /> Release radar online</span>
      </header>

      <section className="relative mb-12 overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-cyan-950/50 via-slate-950/70 to-violet-950/40 p-7 sm:p-11">
        <div className="pointer-events-none absolute -right-20 -top-40 size-[28rem] rounded-full bg-cyan-400/10 blur-[100px]" />
        <div className="relative max-w-3xl">
          <p className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-[.2em] text-cyan-200"><CalendarDays size={14} /> Your entertainment horizon</p>
          <h1 className="text-4xl font-semibold leading-[1.06] tracking-tight text-white sm:text-6xl">A lot to look <span className="text-cyan-200">forward to.</span></h1>
          <p className="mt-5 max-w-xl text-sm leading-7 text-slate-300 sm:text-base">Movies, new seasons, games, and albums with future dates, collected in one place.</p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-slate-200">{all.length} upcoming picks</span>
            {nextRelease && <span className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-slate-300">Next: <strong className="font-medium text-white">{nextRelease.title}</strong> · {nextRelease.displayDate}</span>}
          </div>
        </div>
        <div className="absolute bottom-7 right-8 hidden sm:block"><Link href="/timeline" className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white transition hover:bg-white/10">Open timeline <ArrowRight size={15} /></Link></div>
      </section>

      <section className="mb-14">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div><p className="mb-2 text-xs font-semibold uppercase tracking-[.18em] text-slate-500">From the radar</p><h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Upcoming releases</h2></div>
          <span className="hidden text-right text-xs text-slate-500 sm:block">TMDB · Steam · MusicBrainz</span>
        </div>
        <RadarFeed items={all} emptyMessage="No future releases are available right now. Try refreshing in a little while." />
      </section>

      <footer className="flex items-center justify-between gap-4 border-t border-white/[.08] pt-5 text-xs text-slate-500">
        <span>This product uses TMDB data but is not endorsed or certified by TMDB.</span>
        <span className="hidden items-center gap-1 sm:inline-flex"><Sparkles size={12} /> No AI recommendations or generated data</span>
      </footer>
    </main>
  );
}
