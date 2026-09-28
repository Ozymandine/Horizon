import Link from "next/link";
import { RadarFeed } from "@/components/radar-feed";
import { getUpcomingRadar } from "@/lib/radar";

export default async function UpcomingPage() {
  const feed = await getUpcomingRadar();
  const all = [...feed.MOVIE, ...feed.SHOW, ...feed.GAME, ...feed.MUSIC];

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-5 pb-32 pt-8 sm:px-8 sm:pt-12">
      <header className="mb-10 flex items-center justify-between">
        <Link href="/" className="text-sm font-semibold tracking-[.2em] text-white">HORIZON</Link>
        <Link href="/timeline" className="text-xs text-slate-400 transition hover:text-white">Open timeline <span aria-hidden="true">↗</span></Link>
      </header>

      <section className="mb-14">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div><p className="mb-2 text-xs font-semibold uppercase tracking-[.18em] text-slate-500">United States release dates</p><h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Upcoming releases</h1></div>
          <span className="hidden text-right text-xs text-slate-500 sm:block">{all.length} releases</span>
        </div>
        <RadarFeed items={all} emptyMessage="No future releases are available right now. Try refreshing in a little while." />
      </section>

      <footer className="flex items-center justify-between gap-4 border-t border-white/[.08] pt-5 text-xs text-slate-500">
        <span>This product uses TMDB data but is not endorsed or certified by TMDB.</span>
        <span className="hidden sm:inline">Movies · series · games · music</span>
      </footer>
    </main>
  );
}
