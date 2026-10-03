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
      href: catalog.get(`${item.type}:${item.tmdbId}`)?.href ?? (item.source === "steam" && item.sourceId ? `/releases/steam/${item.sourceId}`
        : item.source === "musicbrainz" && item.sourceId ? `/releases/musicbrainz/${item.sourceId}`
          : item.source === "musicbrainz-recording" && item.sourceId ? `/releases/musicbrainz-recording/${item.sourceId}`
            : item.tmdbId ? (item.type === "SHOW" ? `/shows/${item.tmdbId}` : `/movies/${item.tmdbId}`) : `/entities/${item.id}`),
    }));
  } catch {
    return [];
  }
}

export default async function TimelinePage() {
  const items = await getTrackedTimeline();
  return (
    <main className="timeline-page">
      <h1>The timeline</h1>
      <TimelineSpine items={items} />
    </main>
  );
}
