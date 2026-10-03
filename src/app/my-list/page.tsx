import Link from "next/link";
import { SavedLibrary, type SavedRelease } from "@/components/saved-library";
import { getUpcomingRadar, type RadarItem } from "@/lib/radar";

export const revalidate = 3600;

export default async function MyListPage() {
  const stored = process.env.DATABASE_URL ? await (async () => {
    try {
      const { prisma } = await import("@/lib/prisma");
      const [entities, lists] = await Promise.all([
        prisma.entity.findMany({
          where: { OR: [{ isTracked: true }, { listItems: { some: {} } }, { review: { isNot: null } }] },
          include: { review: true, listItems: { include: { list: { select: { id: true, name: true } } } } },
          orderBy: [{ sortTimestamp: "asc" }, { title: "asc" }],
        }),
        prisma.releaseList.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
      ]);
      return { entities, lists };
    } catch { return null; }
  })() : null;
  const currentFeed = stored?.entities.length ? await getUpcomingRadar() : null;
  const catalog = new Map<string, RadarItem>(currentFeed ? Object.values(currentFeed).flat().filter((release) => release.tmdbId)
    .map((release): [string, RadarItem] => [`${release.type}:${release.tmdbId}`, release]) : []);
  const items: SavedRelease[] = (stored?.entities ?? []).map((entity) => {
    const current = catalog.get(`${entity.type}:${entity.tmdbId}`);
    const href = entity.tmdbId ? (entity.type === "SHOW" ? `/shows/${entity.tmdbId}` : `/movies/${entity.tmdbId}`)
      : entity.source && entity.sourceId && ["apple-song", "apple-album", "apple-artist"].includes(entity.source) ? `/music/catalog/${entity.source.slice(6)}/${encodeURIComponent(entity.sourceId)}`
      : entity.source && entity.sourceId && ["steam", "rawg", "musicbrainz", "musicbrainz-recording"].includes(entity.source) ? `/releases/${entity.source}/${encodeURIComponent(entity.sourceId)}` : `/entities/${entity.id}`;
    return {
      id: entity.id, title: current?.title ?? entity.title, type: entity.type,
      displayDate: current?.displayDate ?? entity.displayDate, posterUrl: current?.posterUrl ?? entity.posterUrl,
      href, isTracked: entity.isTracked, isCompleted: entity.isCompleted,
      review: entity.review ? { rating: entity.review.rating, comment: entity.review.comment } : null,
      lists: entity.listItems.map((entry) => entry.list),
    };
  });
  return <main className="mx-auto min-h-screen max-w-[1600px] px-5 pb-32 pt-10 sm:px-8 sm:pt-12">
    <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">My List</h1>
    {!stored ? <div className="glass mt-8 rounded-3xl p-7 text-sm text-white/60">Your saved releases could not load just now. Refresh to try again.</div>
      : items.length ? <SavedLibrary items={items} lists={stored.lists}/>
      : <div className="glass mt-8 rounded-3xl p-8"><p className="text-lg font-semibold text-white">Save your first pick.</p><Link href="/discover" className="mt-5 inline-flex rounded-full bg-white px-4 py-2.5 text-sm font-medium text-slate-950">Discover releases</Link></div>}
  </main>;
}
