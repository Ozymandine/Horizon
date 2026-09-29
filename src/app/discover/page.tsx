import { ExploreFeed } from "@/components/explore-feed";
import { getExploreRadar, getUpcomingRadar } from "@/lib/radar";

export default async function DiscoverPage() {
  const [feed, initialMovies] = await Promise.all([
    getUpcomingRadar(),
    getExploreRadar("MOVIE", { sort: "popular" }).catch(() => []),
  ]);
  return (
    <main className="mx-auto min-h-screen max-w-7xl px-5 pb-32 pt-10 sm:px-8 sm:pt-14">
      <p className="mb-3 text-xs font-semibold uppercase tracking-[.2em] text-violet-200">Discover</p>
      <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-5xl">Find something worth your time.</h1>
      <p className="mb-8 mt-3 max-w-2xl text-sm leading-6 text-slate-400">Explore American movies and series by genre, year, popularity, or rating. Games and music feature curated U.S. release listings.</p>
      <ExploreFeed upcomingItems={[...feed.GAME, ...feed.MUSIC]} initialMovies={initialMovies} />
      <p className="mt-10 text-xs text-slate-500">Movie and series catalogs use TMDB. Preferences are not required; no AI is used.</p>
    </main>
  );
}
