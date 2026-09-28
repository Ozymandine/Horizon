"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { RadarItem } from "@/lib/radar";

function validHttpsUrl(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export async function addToTimeline(item: RadarItem) {
  if (!process.env.DATABASE_URL) return { ok: false as const, message: "Database connection is not configured." };
  if (!item || !["MOVIE", "SHOW", "GAME", "MUSIC"].includes(item.type)) return { ok: false as const, message: "This item cannot be added." };

  const title = String(item.title ?? "").trim().slice(0, 240);
  const source = String(item.source ?? "").trim().slice(0, 40);
  const sourceId = String(item.sourceId ?? "").trim().slice(0, 160);
  if (!title || !source || !sourceId) return { ok: false as const, message: "This item is missing its title or source." };

  const sortDate = item.sortTimestamp ? new Date(item.sortTimestamp) : null;
  const sortTimestamp = sortDate && Number.isFinite(sortDate.getTime()) ? sortDate : null;
  const payload = {
    title,
    type: item.type,
    status: "UPCOMING" as const,
    confidenceLevel: "OFFICIAL" as const,
    posterUrl: validHttpsUrl(item.posterUrl),
    backdropUrl: validHttpsUrl(item.backdropUrl),
    description: String(item.description ?? "").slice(0, 8000) || null,
    externalUrl: validHttpsUrl(item.externalUrl),
    displayDate: String(item.displayDate ?? "Date TBA").slice(0, 120),
    releasePrecision: item.releaseDate ? (item.isApproximate ? "MONTH" as const : "EXACT_DATE" as const) : "TBD" as const,
    sortTimestamp,
    isApproximate: Boolean(item.isApproximate),
    tmdbId: Number.isSafeInteger(item.tmdbId) ? item.tmdbId : null,
    source,
    sourceId,
    genreIds: Array.isArray(item.genreIds) ? item.genreIds.filter((id) => Number.isSafeInteger(id)).slice(0, 40) : [],
    isTracked: true,
  };

  try {
    let entity = payload.tmdbId
      ? await prisma.entity.findFirst({ where: { tmdbId: payload.tmdbId, type: payload.type } })
      : await prisma.entity.findFirst({ where: { source, sourceId } });
    if (entity) {
      entity = await prisma.entity.update({ where: { id: entity.id }, data: payload });
    } else {
      entity = await prisma.entity.create({ data: payload });
    }
    revalidatePath("/");
    revalidatePath("/timeline");
    revalidatePath("/archive");
    revalidatePath("/my-list");
    revalidatePath("/reviews");
    revalidatePath("/discover");
    return { ok: true as const, id: entity.id };
  } catch {
    return { ok: false as const, message: "Could not save this release. Check the database connection and try again." };
  }
}

export async function removeFromTimeline(entityId: string) {
  if (!process.env.DATABASE_URL || typeof entityId !== "string" || !entityId || entityId.length > 40) {
    return { ok: false as const };
  }
  try {
    await prisma.entity.update({ where: { id: entityId }, data: { isTracked: false } });
    revalidatePath("/my-list");
    revalidatePath("/timeline");
    revalidatePath("/discover");
    return { ok: true as const };
  } catch {
    return { ok: false as const };
  }
}

export async function saveReview(entityId: string, rating: number, comment: string) {
  if (!process.env.DATABASE_URL || typeof entityId !== "string" || !entityId || entityId.length > 40) {
    return { ok: false as const, message: "Database connection is not configured." };
  }
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return { ok: false as const, message: "Choose a rating from 1 to 5 stars." };
  if (typeof comment !== "string" || comment.length > 4000) return { ok: false as const, message: "Keep comments under 4,000 characters." };

  try {
    await prisma.review.upsert({
      where: { entityId },
      create: { entityId, rating, comment: comment.trim() || null },
      update: { rating, comment: comment.trim() || null },
    });
    revalidatePath("/reviews");
    revalidatePath("/discover");
    revalidatePath(`/entities/${entityId}`);
    return { ok: true as const };
  } catch {
    return { ok: false as const, message: "Could not save this review." };
  }
}
