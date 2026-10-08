"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDownUp, Check, Play } from "lucide-react";
import { ScrollRail } from "@/components/scroll-rail";
import type { PlaybackEpisode, PlaybackEpisodes, PlaybackSeason } from "@/lib/playback-metadata";
import { normalizePlaybackRecord, readLocalPlaybackHistory, type PlaybackRecord } from "@/lib/playback-history";
import styles from "./episode-browser.module.css";

export function EpisodeBrowser({ tmdbId, title, seasons, returnTo }: { tmdbId: number; title: string; seasons: PlaybackSeason[]; returnTo: string }) {
  const firstSeason = seasons.find((entry) => entry.season > 0)?.season ?? seasons[0]?.season ?? 1;
  const [season, setSeason] = useState(firstSeason);
  const [episodes, setEpisodes] = useState<PlaybackEpisode[]>([]);
  const [progress, setProgress] = useState<PlaybackRecord[]>([]);
  const [latestFirst, setLatestFirst] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const cache = useRef(new Map<number, PlaybackEpisode[]>());

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(new DOMException("Loading episodes took too long.", "TimeoutError")), 12_000);
    const cached = cache.current.get(season);
    if (!cached) {
      fetch(`/api/playback/episodes?${new URLSearchParams({ tmdbId: String(tmdbId), season: String(season) })}`, { signal: controller.signal, cache: "no-store" })
        .then(async (response) => {
          if (!response.ok) throw new Error("Episodes are unavailable right now.");
          const data = await response.json() as PlaybackEpisodes;
          if (data.season !== season || !Array.isArray(data.episodes)) throw new Error("Episodes are unavailable right now.");
          if (!active || controller.signal.aborted) return;
          cache.current.set(season, data.episodes);
          setEpisodes(data.episodes);
          setLoading(false);
        })
        .catch(() => {
          // A replaced season request must not overwrite the current season's state.
          if (!active) return;
          if (!controller.signal.aborted) { setError("Episodes are unavailable right now."); setLoading(false); }
          else if (controller.signal.reason?.name === "TimeoutError") { setError("Loading episodes took too long."); setLoading(false); }
        });
    }
    return () => { active = false; window.clearTimeout(timeout); controller.abort(); };
  }, [tmdbId, season, retry]);

  useEffect(() => {
    const controller = new AbortController();
    const local = () => readLocalPlaybackHistory().filter((entry) => entry.type === "show" && entry.tmdbId === tmdbId && entry.season === season);
    Promise.resolve().then(() => { if (!controller.signal.aborted) setProgress(local()); });
    const timeout = window.setTimeout(() => controller.abort(), 8_000);
    fetch(`/api/playback/history?${new URLSearchParams({ type: "show", tmdbId: String(tmdbId), season: String(season) })}`, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return;
        const data = await response.json() as { items?: unknown[] };
        if (controller.signal.aborted || !Array.isArray(data.items)) return;
        const recorded = data.items.map(normalizePlaybackRecord).filter((entry): entry is PlaybackRecord => entry !== null && entry.type === "show" && entry.tmdbId === tmdbId && entry.season === season);
        const combined = new Map<string, PlaybackRecord>();
        for (const entry of [...recorded, ...local()]) {
          const previous = combined.get(entry.key);
          if (!previous || Date.parse(entry.updatedAt) > Date.parse(previous.updatedAt)) combined.set(entry.key, entry);
        }
        setProgress([...combined.values()]);
      }).catch(() => {});
    return () => { window.clearTimeout(timeout); controller.abort(); };
  }, [tmdbId, season]);

  function switchSeason(nextSeason: number) {
    const cached = cache.current.get(nextSeason);
    setSeason(nextSeason);
    setEpisodes(cached ?? []);
    setLoading(!cached);
    setError("");
    setProgress([]);
  }

  const displayed = useMemo(() => latestFirst ? [...episodes].reverse() : episodes, [episodes, latestFirst]);

  return <section className={styles.section} aria-labelledby={`episodes-${tmdbId}`}>
    <div className={styles.heading}>
      <h2 id={`episodes-${tmdbId}`}>Episodes</h2>
      <div className={styles.options}>
        <button type="button" onClick={() => setLatestFirst((value) => !value)} aria-label={`Sort episodes ${latestFirst ? "oldest" : "newest"} first`}><ArrowDownUp size={15}/>{latestFirst ? "Newest" : "Oldest"}</button>
        <label className={styles.seasonSelect}><span className="sr-only">Choose season</span><select value={season} onChange={(event) => switchSeason(Number(event.target.value))}>{seasons.map((entry) => <option value={entry.season} key={entry.season}>{entry.name}</option>)}</select></label>
      </div>
    </div>
    {loading && <div className={styles.loading} role="status">Loading episodes…</div>}
    {error && <div className={styles.loading} role="status"><p>{error}</p><button type="button" onClick={() => { setLoading(true); setError(""); setRetry((value) => value + 1); }}>Try again</button></div>}
    {!loading && !error && !displayed.length && <div className={styles.loading}>Episodes have not been announced yet.</div>}
    {!loading && !error && displayed.length > 0 && <ScrollRail label={`${title}, season ${season} episodes`} className={styles.rail} trackClassName={styles.track}>{displayed.map((entry) => {
      const record = progress.find((value) => value.season === season && value.episode === entry.episode);
      const percentage = record && Number.isFinite(record.duration) && record.duration > 0 ? Math.min(100, Math.max(0, record.position / record.duration * 100)) : 0;
      const playing = Boolean(record && !record.completed && record.position >= 10);
      const href = `/api/stream-player?${new URLSearchParams({ type: "show", tmdbId: String(tmdbId), season: String(season), episode: String(entry.episode), title, returnTo })}`;
      return <article className={styles.card} key={entry.episode}>
        <a href={href} className={styles.artwork} aria-label={`${playing ? "Resume" : "Play"} ${title}, season ${season}, episode ${entry.episode}: ${entry.title}`}>
          {entry.stillUrl ? <Image src={entry.stillUrl} alt="" fill sizes="(max-width: 640px) 72vw, 290px" className={styles.still}/> : <span className={styles.empty}><Play size={34}/></span>}
          <span className={styles.number}>E{entry.episode}</span>
          {record?.completed && <span className={styles.watched}><Check size={13}/> Watched</span>}
          {entry.runtime && <span className={styles.runtime}>{entry.runtime}m</span>}
          <span className={styles.play}><Play size={24} fill="currentColor"/></span>
          {percentage > 0 && <span className={styles.progress}><span style={{ width: `${percentage}%` }}/></span>}
        </a>
        <a href={href} className={styles.title}>{entry.title}</a>
        {playing && <span className={styles.resume}>Resume · {Math.floor(record!.position / 60)}m watched</span>}
        <details className={styles.synopsis}><summary><span className={styles.preview}>{entry.overview || "A synopsis has not been published yet."}</span><span className={styles.more}>Show more</span></summary><p>{entry.overview || "A synopsis has not been published yet."}</p>{entry.airDate && <small>Aired {new Date(`${entry.airDate}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}</small>}</details>
      </article>;
    })}</ScrollRail>}
  </section>;
}
