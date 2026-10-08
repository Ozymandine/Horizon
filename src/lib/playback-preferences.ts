export const PLAYBACK_SETTINGS_KEY = "horizon:player:preferences:v1";
export const DEFAULT_PLAYBACK_SETTINGS = { fit: "fit", zoom: 1, volume: 1, muted: false, speed: 1, subtitleSize: 100 } as const;
export type PlaybackPreferences = { fit: "fit" | "fill" | "auto"; zoom: number; volume: number; muted: boolean; speed: number; subtitleSize: number };

export function playbackPreferences(value: unknown): PlaybackPreferences {
  const data = value && typeof value === "object" ? value as Partial<PlaybackPreferences> : {};
  const bound = (v: unknown, fallback: number, min: number, max: number) => typeof v === "number" && Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : fallback;
  return { fit: ["fit", "fill", "auto"].includes(data.fit ?? "") ? data.fit! : "fit", zoom: bound(data.zoom, 1, 1, 2.5), volume: bound(data.volume, 1, 0, 1), muted: data.muted === true, speed: bound(data.speed, 1, .5, 2), subtitleSize: bound(data.subtitleSize, 100, 75, 175) };
}
