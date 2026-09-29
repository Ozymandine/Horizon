import { TimelineSpine, type TimelineItem } from "@/components/timeline-spine";
import { getUpcomingRadar, type RadarItem } from "@/lib/radar";

export const revalidate = 3600;

async function getTrackedTimeline(): Promise<TimelineItem[]> {
  if (!process.env.DATABASE_URL) return [];
  try {
    const { prisma } = await import("@/lib/prisma");
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const entities = await prisma.entity.findMany({
      where: {
        isTracked: true,
        status: "UPCOMING",
        OR: [{ sortTimestamp: null }, { sortTimestamp: { gte: today } }],
      },
      orderBy: [{ sortTimestamp: "asc" }, { title: "asc" }],
      select: {
        id: true,
        title: true,
        type: true,
        displayDate: true,
        sortTimestamp: true,
        dateEnd: true,
        isApproximate: true,
        confidenceLevel: true,
        posterUrl: true,
        tmdbId: true,
        source: true,
        sourceId: true,
      },
    });
    const currentFeed = await getUpcomingRadar();
    const catalog = new Map<string, RadarItem>(Object.values(currentFeed).flat().filter((release) => release.tmdbId)
      .map((release): [string, RadarItem] => [`${release.type}:${release.tmdbId}`, release]));
    return entities.map((item) => ({
      ...item,
      title: catalog.get(`${item.type}:${item.tmdbId}`)?.title ?? item.title,
      displayDate: catalog.get(`${item.type}:${item.tmdbId}`)?.displayDate ?? item.displayDate,
      posterUrl: catalog.get(`${item.type}:${item.tmdbId}`)?.posterUrl ?? item.posterUrl,
      sortTimestamp: catalog.get(`${item.type}:${item.tmdbId}`)?.sortTimestamp ?? item.sortTimestamp?.toISOString() ?? null,
      dateEnd: item.dateEnd?.toISOString() ?? null,
      href: catalog.get(`${item.type}:${item.tmdbId}`)?.href ?? (item.tmdbId ? (item.type === "SHOW" ? `/shows/${item.tmdbId}` : `/movies/${item.tmdbId}`) : `/entities/${item.id}`),
    }));
  } catch {
    return [];
  }
}

export default async function TimelinePage() {
  const items = await getTrackedTimeline();
  return (
    <main className="mx-auto min-h-screen max-w-[1500px] px-5 pb-32 pt-10 sm:px-8 sm:pt-14">
      <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-5xl">The timeline</h1>
      <p className="mb-9 mt-3 max-w-xl text-sm leading-6 text-slate-400">One month at a time. Hover over a poster to reveal its release date.</p>
      <TimelineSpine items={items} />
    </main>
  );
}
