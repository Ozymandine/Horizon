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

function logActionError(action: string, error: unknown) {
  const failure = error && typeof error === "object" ? error as { name?: unknown; code?: unknown; message?: unknown } : {};
  const message = String(failure.message ?? error ?? "Unknown database error")
    .replace(/postgres(?:ql)?:\/\/[^\s'"`]+/gi, "[database connection]")
    .slice(0, 300);
  console.error(`[horizon] ${action} failed`, {
    name: String(failure.name ?? "Error").slice(0, 80),
    code: String(failure.code ?? "").slice(0, 40),
    message,
  });
}

function saveErrorMessage(error: unknown, subject: string) {
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
  const message = String(error instanceof Error ? error.message : error ?? "");
  if (code === "P2002") return "This release is already saved to My List.";
  if (/^P10\d\d$/.test(code) || code === "ECONNREFUSED" || code === "SELF_SIGNED_CERT_IN_CHAIN" || /SELF_SIGNED_CERT_IN_CHAIN|ECONNREFUSED/i.test(message)) {
    return "Horizon could not reach its saved list just now. Please try again in a moment.";
  }
  return `Horizon could not save this ${subject}. Please try again.`;
}

async function saveRadarEntity(item: RadarItem, track: boolean) {
  if (!item || !["MOVIE", "SHOW", "GAME", "MUSIC"].includes(item.type)) return { ok: false as const, message: "This item cannot be added." };

  const title = String(item.title ?? "").trim().slice(0, 240);
  const source = String(item.source ?? "").trim().slice(0, 40);
  const sourceId = String(item.sourceId ?? "").trim().slice(0, 160);
  if (!title || !source || !sourceId) return { ok: false as const, message: "This item is missing its title or source." };

  const sortDate = item.sortTimestamp ? new Date(item.sortTimestamp) : null;
  const sortTimestamp = sortDate && Number.isFinite(sortDate.getTime()) ? sortDate : null;
  const dateLabel = String(item.displayDate ?? "").trim();
  const releasePrecision = !sortTimestamp ? "TBD" as const
    : !item.isApproximate ? "EXACT_DATE" as const
    : /\bq[1-4]\b/i.test(dateLabel) ? "QUARTER" as const
    : /\b(spring|summer|autumn|fall|winter)\b/i.test(dateLabel) ? "SEASON" as const
    : /^20\d{2}(?:\s|$|[·,])/.test(dateLabel) ? "YEAR" as const
    : "MONTH" as const;
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
    releasePrecision,
    sortTimestamp,
    isApproximate: Boolean(item.isApproximate),
    tmdbId: Number.isSafeInteger(item.tmdbId) ? item.tmdbId : null,
    source,
    sourceId,
    genreIds: Array.isArray(item.genreIds) ? item.genreIds.filter((id) => Number.isSafeInteger(id)).slice(0, 40) : [],
    isTracked: track,
  };

  const existing = payload.tmdbId
    ? await prisma.entity.findFirst({ where: { tmdbId: payload.tmdbId, type: payload.type } })
    : await prisma.entity.findFirst({ where: { source, sourceId } });
  const entity = existing
    ? await prisma.entity.update({ where: { id: existing.id }, data: { ...payload, isTracked: track || existing.isTracked } })
    : await prisma.entity.create({ data: payload });
  return { ok: true as const, id: entity.id };
}

export async function addToTimeline(item: RadarItem) {
  if (!process.env.DATABASE_URL) return { ok: false as const, message: "Database connection is not configured." };
  try {
    const result = await saveRadarEntity(item, true);
    if (!result.ok) return result;
    revalidatePath("/");
    revalidatePath("/timeline");
    revalidatePath("/archive");
    revalidatePath("/my-list");
    revalidatePath("/reviews");
    revalidatePath("/discover");
    return result;
  } catch (error) {
    logActionError("add to timeline", error);
    return { ok: false as const, message: saveErrorMessage(error, "release") };
  }
}

export async function getReleaseLists() {
  if (!process.env.DATABASE_URL) return [];
  try {
    return await prisma.releaseList.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
  } catch (error) {
    logActionError("load custom lists", error);
    return [];
  }
}

export async function addItemToReleaseList(item: RadarItem, listId: string) {
  if (!process.env.DATABASE_URL) return { ok: false as const, message: "Lists are not available right now." };
  if (typeof listId !== "string" || listId.length > 40) return { ok: false as const, message: "Choose a valid list." };
  try {
    const list = await prisma.releaseList.findUnique({ where: { id: listId }, select: { id: true } });
    if (!list) return { ok: false as const, message: "That list no longer exists." };
    const entity = await saveRadarEntity(item, false);
    if (!entity.ok) return entity;
    await prisma.releaseListItem.upsert({
      where: { listId_entityId: { listId, entityId: entity.id } },
      create: { listId, entityId: entity.id },
      update: {},
    });
    revalidatePath("/my-list");
    return { ok: true as const, listName: (await prisma.releaseList.findUnique({ where: { id: listId }, select: { name: true } }))?.name ?? "your list" };
  } catch (error) {
    logActionError("add release to custom list", error);
    return { ok: false as const, message: saveErrorMessage(error, "release") };
  }
}

export async function createReleaseListAndAdd(item: RadarItem, title: string) {
  if (!process.env.DATABASE_URL) return { ok: false as const, message: "Lists are not available right now." };
  const name = String(title ?? "").trim().replace(/\s+/g, " ").slice(0, 80);
  if (name.length < 1) return { ok: false as const, message: "Give your list a title." };
  try {
    const entity = await saveRadarEntity(item, false);
    if (!entity.ok) return entity;
    const list = await prisma.releaseList.create({ data: { name } });
    await prisma.releaseListItem.create({ data: { listId: list.id, entityId: entity.id } });
    revalidatePath("/my-list");
    return { ok: true as const, list: { id: list.id, name: list.name } };
  } catch (error) {
    logActionError("create custom list", error);
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
    if (code === "P2002") return { ok: false as const, message: "A list with that title already exists." };
    return { ok: false as const, message: saveErrorMessage(error, "list") };
  }
}

export async function removeFromTimeline(entityId: string) {
  if (!process.env.DATABASE_URL || typeof entityId !== "string" || !entityId || entityId.length > 40) {
    return { ok: false as const, message: "This release could not be removed. Please refresh and try again." };
  }
  try {
    await prisma.entity.update({ where: { id: entityId }, data: { isTracked: false } });
    revalidatePath("/my-list");
    revalidatePath("/timeline");
    revalidatePath("/discover");
    return { ok: true as const };
  } catch (error) {
    logActionError("remove from My List", error);
    return { ok: false as const, message: saveErrorMessage(error, "release") };
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
    revalidatePath("/my-list");
    revalidatePath("/discover");
    revalidatePath(`/entities/${entityId}`);
    return { ok: true as const };
  } catch (error) {
    logActionError("save review", error);
    return { ok: false as const, message: saveErrorMessage(error, "review") };
  }
}
