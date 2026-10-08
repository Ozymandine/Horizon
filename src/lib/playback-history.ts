export const PLAYBACK_HISTORY_KEY = "horizon:playback:v1";
export type PlaybackType = "movie" | "show";
export type PlaybackRecord = {
  key: string; type: PlaybackType; tmdbId: number; season: number; episode: number;
  position: number; duration: number; title: string; posterUrl: string | null; backdropUrl: string | null;
  completed: boolean; updatedAt: string;
  playbackId?: string; sessionStartedAt?: number; recordedAt?: number; sequence?: number;
};
export type PlaybackIdentity = { type: PlaybackType; tmdbId: number; season?: number; episode?: number };
export type PlaybackSave = PlaybackIdentity & {
  key: string; season: number; episode: number; position: number; duration: number;
  title: string; posterUrl: string | null; backdropUrl: string | null; completed: boolean;
  playbackId: string; sessionStartedAt: number; recordedAt: number; sequence: number; restart: boolean;
};

function integer(value: unknown, minimum: number, maximum: number): number | null {
  const number = typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value;
  return typeof number === "number" && Number.isSafeInteger(number) && number >= minimum && number <= maximum ? number : null;
}
export function playbackKey(input: PlaybackIdentity) {
  return input.type === "movie" ? `movie:${input.tmdbId}` : `show:${input.tmdbId}:${input.season ?? 1}:${input.episode ?? 1}`;
}
export function parsePlaybackIdentity(input: Record<string, unknown>, requireEpisode = false): PlaybackIdentity | null {
  if (input.type !== "movie" && input.type !== "show") return null;
  const tmdbId = integer(input.tmdbId, 1, 2_147_483_647);
  if (tmdbId === null) return null;
  const hasSeason = input.season !== undefined && input.season !== null;
  const hasEpisode = input.episode !== undefined && input.episode !== null;
  if (input.type === "movie") return hasSeason || hasEpisode ? null : { type: "movie", tmdbId };
  if (!hasSeason && !hasEpisode && !requireEpisode) return { type: "show", tmdbId };
  const season = integer(input.season, 0, 1000);
  const episode = integer(input.episode, 1, 10_000);
  return season !== null && episode !== null ? { type: "show", tmdbId, season, episode } : null;
}
export function playbackComplete(position: number, duration: number) {
  return duration >= 60 && duration - position <= Math.min(90, duration * .04);
}
export function safePlaybackImage(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 500) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "image.tmdb.org" && /^\/t\/p\/(original|w\d+)\/[A-Za-z0-9_.-]+$/.test(url.pathname) && !url.username && !url.password && !url.search && !url.hash ? url.href : null;
  } catch { return null; }
}
export function parsePlaybackSave(value: unknown, now = Date.now()): PlaybackSave | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  const identity = parsePlaybackIdentity(input, true);
  if (!identity || typeof input.position !== "number" || typeof input.duration !== "number" || !Number.isFinite(input.position) || !Number.isFinite(input.duration) || input.position < 0 || input.duration < 0 || input.position > 172_800 || input.duration > 172_800 || (input.duration > 0 && input.position > input.duration + 5)) return null;
  const sessionStartedAt = integer(input.sessionStartedAt, 1, now + 30_000);
  const recordedAt = integer(input.recordedAt, 1, now + 30_000);
  const sequence = integer(input.sequence, 0, 2_147_483_647);
  if (sessionStartedAt === null || recordedAt === null || sequence === null || recordedAt < sessionStartedAt || typeof input.playbackId !== "string" || !/^[A-Za-z0-9_-]{8,80}$/.test(input.playbackId)) return null;
  const position = input.restart === true ? 0 : input.duration ? Math.min(input.position, input.duration) : input.position;
  const title = typeof input.title === "string" ? input.title.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 240) : "";
  return { ...identity, key: playbackKey(identity), season: identity.season ?? 0, episode: identity.episode ?? 0, position, duration: input.duration, title: title || `${identity.type === "movie" ? "Movie" : "Show"} ${identity.tmdbId}`, posterUrl: safePlaybackImage(input.posterUrl), backdropUrl: safePlaybackImage(input.backdropUrl), completed: playbackComplete(position, input.duration), playbackId: input.playbackId, sessionStartedAt, recordedAt, sequence, restart: input.restart === true };
}
// Session ownership prevents a delayed closing tab from overwriting newer playback.
export function acceptsPlaybackSave(previous: Pick<PlaybackSave, "playbackId" | "sessionStartedAt" | "sequence" | "recordedAt">, next: Pick<PlaybackSave, "playbackId" | "sessionStartedAt" | "sequence" | "recordedAt">) {
  return next.sessionStartedAt > previous.sessionStartedAt || (next.sessionStartedAt === previous.sessionStartedAt && next.playbackId === previous.playbackId && next.sequence > previous.sequence && next.recordedAt >= previous.recordedAt);
}
export function normalizePlaybackRecord(value: unknown): PlaybackRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  const identity = parsePlaybackIdentity({ type: input.type, tmdbId: input.tmdbId, ...(input.type === "show" ? { season: input.season, episode: input.episode } : {}) }, true);
  if (!identity || typeof input.position !== "number" || typeof input.duration !== "number" || !Number.isFinite(input.position) || !Number.isFinite(input.duration) || input.position < 0 || input.position > 172_800 || input.duration < 0 || input.duration > 172_800) return null;
  const updatedAt = typeof input.updatedAt === "string" ? input.updatedAt : typeof input.recordedAt === "number" ? new Date(input.recordedAt).toISOString() : "";
  if (!Number.isFinite(Date.parse(updatedAt))) return null;
  return { ...identity, key: playbackKey(identity), season: identity.season ?? 0, episode: identity.episode ?? 0, position: input.position, duration: input.duration, title: typeof input.title === "string" ? input.title.slice(0, 240) : `${identity.type === "movie" ? "Movie" : "Show"} ${identity.tmdbId}`, posterUrl: safePlaybackImage(input.posterUrl), backdropUrl: safePlaybackImage(input.backdropUrl), completed: input.completed === true || playbackComplete(input.position, input.duration), updatedAt };
}
export function continueWatchingRecords(records: PlaybackRecord[], type: PlaybackType, limit = 40) {
  const latest = new Map<number, PlaybackRecord>();
  for (const record of [...records].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))) {
    if (record.type === type && !latest.has(record.tmdbId)) latest.set(record.tmdbId, record);
  }
  return [...latest.values()].filter((record) => record.position >= 5 && !record.completed).slice(0, limit);
}
export function readLocalPlaybackHistory(): PlaybackRecord[] {
  try {
    const values: unknown = JSON.parse(localStorage.getItem(PLAYBACK_HISTORY_KEY) ?? "{}");
    if (!values || typeof values !== "object" || Array.isArray(values)) return [];
    return Object.values(values).slice(0, 500).map(normalizePlaybackRecord).filter((record): record is PlaybackRecord => record !== null);
  } catch { return []; }
}
export function playbackResumeLink(record: PlaybackRecord, returnTo = "/discover") {
  const params = new URLSearchParams({ type: record.type, tmdbId: String(record.tmdbId), title: record.title, returnTo });
  if (record.type === "show") { params.set("season", String(record.season)); params.set("episode", String(record.episode)); }
  return `/api/stream-player?${params}`;
}
