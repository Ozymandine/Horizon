import { notFound } from "next/navigation";
import { EntityDetail } from "@/components/entity-detail";

export default async function EntityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!process.env.DATABASE_URL || !id) notFound();

  let entity;
  try {
    const { prisma } = await import("@/lib/prisma");
    entity = await prisma.entity.findUnique({
      where: { id },
      include: {
        credits: { orderBy: [{ sortOrder: "asc" }, { name: "asc" }] },
        media: { orderBy: [{ sortOrder: "asc" }, { title: "asc" }] },
        eventDates: { orderBy: { eventTime: "asc" } },
      },
    });
  } catch {
    notFound();
  }
  if (!entity) notFound();
  return <EntityDetail entity={entity} />;
}
