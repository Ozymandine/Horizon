import { notFound } from "next/navigation";
import { EntityDetail } from "@/components/entity-detail";

export default async function EntityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!process.env.DATABASE_URL || !id) notFound();

  try {
    const { prisma } = await import("@/lib/prisma");
    const entity = await prisma.entity.findUnique({
      where: { id },
      include: {
        credits: { orderBy: [{ sortOrder: "asc" }, { name: "asc" }] },
        media: { orderBy: [{ sortOrder: "asc" }, { title: "asc" }] },
        eventDates: { orderBy: { eventTime: "asc" } },
      },
    });
    if (!entity) notFound();
    return <EntityDetail entity={entity} />;
  } catch {
    notFound();
  }
}
