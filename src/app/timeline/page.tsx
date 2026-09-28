import { TimelineSpine, type TimelineItem } from "@/components/timeline-spine";

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
      },
    });
    return entities.map((item) => ({
      ...item,
      sortTimestamp: item.sortTimestamp?.toISOString() ?? null,
      dateEnd: item.dateEnd?.toISOString() ?? null,
      href: `/entities/${item.id}`,
    }));
  } catch {
    return [];
  }
}

export default async function TimelinePage() {
  const items = await getTrackedTimeline();
  return (
    <main className="mx-auto min-h-screen max-w-[1500px] px-5 pb-32 pt-10 sm:px-8 sm:pt-14">
      <p className="mb-3 text-xs font-semibold uppercase tracking-[.2em] text-cyan-200">Your release radar</p>
      <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-5xl">The timeline</h1>
      <p className="mb-9 mt-3 max-w-xl text-sm leading-6 text-slate-400">Follow future releases, switch between the timeline and calendar, or browse the unscheduled horizon.</p>
      <TimelineSpine items={items} />
    </main>
  );
}
