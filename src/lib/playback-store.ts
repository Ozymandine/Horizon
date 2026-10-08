import "server-only";

import { prisma } from "@/lib/prisma";
import { acceptsPlaybackSave, playbackKey, type PlaybackIdentity, type PlaybackRecord, type PlaybackSave, type PlaybackType } from "@/lib/playback-history";
import type { PlaybackProgress } from "@/generated/prisma/client";

function record(row: PlaybackProgress | null): PlaybackRecord | null {
  if (!row) return null;
  return {
    key: row.key, type: row.type as PlaybackType, tmdbId: row.tmdbId,
    season: row.season, episode: row.episode, position: row.position, duration: row.duration,
    title: row.title, posterUrl: row.posterUrl, backdropUrl: row.backdropUrl,
    completed: row.completed, updatedAt: row.updatedAt.toISOString(),
    playbackId: row.playbackId, sessionStartedAt: row.sessionStartedAt.getTime(), recordedAt: row.recordedAt.getTime(), sequence: row.sequence,
  };
}
export async function getPlaybackProgress(identity: PlaybackIdentity) {
  if (identity.type === "show" && identity.season === undefined) {
    return record(await prisma.playbackProgress.findFirst({ where: { type: identity.type, tmdbId: identity.tmdbId }, orderBy: [{ updatedAt: "desc" }, { sequence: "desc" }] }));
  }
  return record(await prisma.playbackProgress.findUnique({ where: { key: playbackKey(identity) } }));
}
export async function savePlaybackProgress(input: PlaybackSave) {
  // Serialize writes per title across Vercel instances. This also protects episode
  // changes: a delayed save from the previous episode cannot become the latest.
  return prisma.$transaction(async (transaction) => {
    const group = `${input.type}:${input.tmdbId}`;
    await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${group}, 0))`;
    const latest = await transaction.playbackProgress.findFirst({ where: { type: input.type, tmdbId: input.tmdbId }, orderBy: [{ sessionStartedAt: "desc" }, { sequence: "desc" }, { recordedAt: "desc" }] });
    if (latest && !acceptsPlaybackSave({ playbackId: latest.playbackId, sessionStartedAt: latest.sessionStartedAt.getTime(), recordedAt: latest.recordedAt.getTime(), sequence: latest.sequence }, input)) {
      return { saved: false, progress: record(await transaction.playbackProgress.findUnique({ where: { key: input.key } })) };
    }
    const existing = await transaction.playbackProgress.findUnique({ where: { key: input.key } });
    const data = {
      type: input.type, tmdbId: input.tmdbId, season: input.season, episode: input.episode,
      position: input.position, duration: input.duration, completed: input.completed,
      title: input.title === `${input.type === "movie" ? "Movie" : "Show"} ${input.tmdbId}` && existing ? existing.title : input.title,
      posterUrl: input.posterUrl ?? existing?.posterUrl ?? null, backdropUrl: input.backdropUrl ?? existing?.backdropUrl ?? null,
      playbackId: input.playbackId, sessionStartedAt: new Date(input.sessionStartedAt), recordedAt: new Date(input.recordedAt), sequence: input.sequence,
      updatedAt: new Date(input.recordedAt),
    };
    const saved = await transaction.playbackProgress.upsert({ where: { key: input.key }, create: { key: input.key, ...data }, update: data });
    return { saved: true, progress: record(saved) };
  }, { maxWait: 5000, timeout: 10_000 });
}
export async function getPlaybackHistory(type: PlaybackType, filter?: { tmdbId: number; season: number }) {
  const rows = await prisma.playbackProgress.findMany({ where: { type, ...(filter ? { tmdbId: filter.tmdbId, season: filter.season } : {}) }, orderBy: [{ updatedAt: "desc" }, { sequence: "desc" }], take: filter ? 1000 : 500 });
  // Return completed latest records too; clients must group before filtering so
  // finishing an episode does not resurrect an older unfinished episode.
  return rows.map((row) => record(row)!);
}
