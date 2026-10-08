"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Clock3, Play } from "lucide-react";
import { MediaArtwork } from "@/components/media-artwork";
import { continueWatchingRecords, normalizePlaybackRecord, playbackResumeLink, readLocalPlaybackHistory, type PlaybackRecord, type PlaybackType } from "@/lib/playback-history";
import styles from "@/components/continue-watching.module.css";

function mergeRecords(server: PlaybackRecord[], local: PlaybackRecord[]) {
  const values = new Map<string, PlaybackRecord>();
  for (const record of [...server, ...local]) {
    const previous = values.get(record.key);
    if (!previous || Date.parse(record.updatedAt) > Date.parse(previous.updatedAt)) values.set(record.key, record);
  }
  return [...values.values()];
}
function timeLabel(seconds: number) {
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  return minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m left` : `${minutes}m left`;
}
export function ContinueWatching({ type, returnTo, onBrowse }: { type: PlaybackType; returnTo: string; onBrowse: () => void }) {
  const [records, setRecords] = useState<PlaybackRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let server: PlaybackRecord[] = [];
    const update = () => setRecords(continueWatchingRecords(mergeRecords(server, readLocalPlaybackHistory()), type));
    update();
    void fetch(`/api/playback/history?type=${type}`, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]), cache: "no-store" }).then(async (response) => {
      if (!response.ok) throw new Error("history");
      const data = await response.json() as { items?: unknown[] };
      if (controller.signal.aborted) return;
      server = (data.items ?? []).map(normalizePlaybackRecord).filter((record): record is PlaybackRecord => !!record);
      update(); setOffline(false);
    }).catch(() => { if (!controller.signal.aborted) { update(); setOffline(true); } }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    const visible = () => { if (document.visibilityState === "visible") setRevision((value) => value + 1); };
    window.addEventListener("storage", update);
    window.addEventListener("pageshow", update);
    document.addEventListener("visibilitychange", visible);
    return () => { controller.abort(); window.removeEventListener("storage", update); window.removeEventListener("pageshow", update); document.removeEventListener("visibilitychange", visible); };
  }, [type, revision]);
  return <section className={styles.page} aria-label="Continue Watching">
    <div className={styles.heading}><h1>Continue Watching</h1><button type="button" onClick={onBrowse}>Browse {type === "movie" ? "movies" : "shows"}</button></div>
    {offline && <p className={styles.notice}>Showing watch history saved on this device.<button type="button" onClick={() => setRevision((value) => value + 1)}>Retry sync</button></p>}
    {loading && !records.length ? <p className={styles.loading} role="status">Loading watch history…</p> : records.length ? <div className={styles.grid}>{records.map((record) => <article key={record.key} className={styles.card}>
      <Link href={playbackResumeLink(record, returnTo)} prefetch={false} aria-label={`Resume ${record.title}${record.type === "show" ? ` season ${record.season} episode ${record.episode}` : ""}`}>
        <div className={styles.art}><MediaArtwork title={record.title} type={record.type === "movie" ? "MOVIE" : "SHOW"} imageUrl={record.backdropUrl ?? record.posterUrl}/><div className={styles.shade}/><span className={styles.play}><Play size={14} fill="currentColor"/> Resume</span><div className={styles.progress} role="progressbar" aria-label={`${record.title} progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={record.duration ? Math.min(100, Math.round(record.position / record.duration * 100)) : 0}><span style={{ width: `${record.duration ? Math.min(100, record.position / record.duration * 100) : 0}%` }}/></div></div>
        <h2>{record.title}</h2>
      </Link>
      <div className={styles.meta}>{record.type === "show" && <span>S{record.season} · E{record.episode}</span>}<span>{record.duration > record.position ? timeLabel(record.duration - record.position) : `${Math.floor(record.position / 60)}m watched`}</span><Link href={`/${record.type === "movie" ? "movies" : "shows"}/${record.tmdbId}?${new URLSearchParams({ returnTo })}`} prefetch={false}>Details</Link></div>
    </article>)}</div> : <div className={styles.empty}><Clock3 size={28}/><h2>Pick up where you left off</h2><p>{type === "movie" ? "Movies" : "Shows"} appear here after you start watching.</p><button type="button" onClick={onBrowse}>Browse {type === "movie" ? "movies" : "shows"}</button></div>}
  </section>;
}
