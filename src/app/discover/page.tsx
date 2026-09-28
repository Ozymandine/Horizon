import { Compass, Sparkles } from "lucide-react";
import { RadarFeed } from "@/components/radar-feed";
import { getUpcomingRadar, type RadarItem } from "@/lib/radar";

type Preference = { type: string; genreIds: number[] };

async function getPreferences(): Promise<Preference[]> {
  if (!process.env.DATABASE_URL) return [];
  try {
    const { prisma } = await import("@/lib/prisma");
    const reviews = await prisma.review.findMany({
      where: { rating: { gte: 4 } },
      select: { entity: { select: { type: true, genreIds: true } } },
    });
    return reviews.map(({ entity }) => ({ type: entity.type, genreIds: entity.genreIds }));
  } catch {
    return [];
  }
}

function personalize(items: RadarItem[], preferences: Preference[]) {
  if (!preferences.length) return items;
  const typeWeights = new Map<string, number>();
  const genreWeights = new Map<number, number>();
  for (const preference of preferences) {
    typeWeights.set(preference.type, (typeWeights.get(preference.type) ?? 0) + 1);
    for (const genre of preference.genreIds) genreWeights.set(genre, (genreWeights.get(genre) ?? 0) + 1);
  }
  return items.map((item, index) => ({ item, index, score: (typeWeights.get(item.type) ?? 0) * 2 + item.genreIds.reduce((sum, genre) => sum + (genreWeights.get(genre) ?? 0) * 3, 0) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ item }) => item);
}

export default async function DiscoverPage() {
  const [feed, preferences] = await Promise.all([getUpcomingRadar(), getPreferences()]);
  const recommendations = personalize(Object.values(feed).flat(), preferences);
  return (
    <main className="mx-auto min-h-screen max-w-7xl px-5 pb-32 pt-10 sm:px-8 sm:pt-14">
      <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[.2em] text-violet-200"><Compass size={14} /> Discover</p>
      <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-5xl">Find your next countdown.</h1>
      <p className="mt-3 max-w-xl text-sm leading-6 text-slate-400">Browse future releases across movies, TV, games, and music. Save anything you want to follow.</p>
      <div className="glass mb-8 mt-8 flex flex-wrap items-center gap-4 rounded-3xl p-5 sm:p-6">
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-violet-200/10 text-violet-200"><Sparkles size={20} /></span>
        <div>
          <h2 className="font-medium text-white">{preferences.length ? "Picked from your ratings" : "Your recommendations are taking shape"}</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-400">{preferences.length
            ? `Ranked using ${preferences.length} release${preferences.length === 1 ? "" : "s"} you rated 4 or 5 stars. More ratings help tune the mix.`
            : "Rate a few things in Reviews. Horizon will use your favorite categories and genres to move similar releases to the top."}</p>
        </div>
      </div>
      <RadarFeed items={recommendations} emptyMessage="No upcoming items from the connected catalogs right now." />
      <p className="mt-10 text-xs text-slate-500">Feeds from TMDB, Steam, and MusicBrainz. No AI or generated recommendations.</p>
    </main>
  );
}
