"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { Disc3, FileText, Pause, Play, SkipBack, SkipForward } from "lucide-react";
import { spotifyAccessToken, spotifyConnected } from "@/lib/spotify-auth";
import { useSpotifyConnected } from "@/lib/use-browser-preferences";

type SpotifyTrack = { id?: string; uri?: string; name?: string; duration_ms?: number; artists?: { name: string }[]; album?: { images?: { url?: string }[] } };
type PlayerState = { paused: boolean; position?: number; duration?: number; track_window?: { current_track?: SpotifyTrack | null } };
type SpotifyDevice = { device_id: string };
type SpotifyPlayer = {
  connect(): Promise<boolean>;
  disconnect(): void;
  addListener(event: string, callback: (value: never) => void): boolean;
  togglePlay(): Promise<void>;
  nextTrack(): Promise<void>;
  previousTrack(): Promise<void>;
  seek(positionMs: number): Promise<void>;
  getCurrentState(): Promise<PlayerState | null>;
  activateElement(): Promise<void>;
};
type SpotifyRequest = { title: string; artist?: string; album?: string; kind?: "track" | "album"; market?: string; uri?: string; artwork?: string; returnTo?: string };
type DisplayTrack = { id?: string; title: string; artist: string; artwork?: string; durationMs: number };

declare global {
  interface Window {
    Spotify?: { Player: new (options: { name: string; volume: number; getOAuthToken: (callback: (token: string) => void) => void }) => SpotifyPlayer };
    onSpotifyWebPlaybackSDKReady?: () => void;
  }
}

function formatTime(milliseconds: number) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function SpotifyController() {
  const router = useRouter();
  const playerRef = useRef<SpotifyPlayer | null>(null);
  const deviceRef = useRef("");
  const queuedRequestRef = useRef<SpotifyRequest | null>(null);
  const connected = useSpotifyConnected();
  const [track, setTrack] = useState<DisplayTrack | null>(null);
  const [paused, setPaused] = useState(true);
  const [positionMs, setPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [error, setError] = useState("");

  const syncFromPlayer = useCallback((state: PlayerState | null) => {
    if (!state) {
      setTrack(null);
      setPositionMs(0);
      setDurationMs(0);
      return;
    }
    setPaused(state.paused);
    const current = state.track_window?.current_track;
    if (!current?.name) {
      setTrack(null);
      return;
    }
    const duration = state.duration ?? current.duration_ms ?? 0;
    const position = state.position ?? 0;
    setTrack({ id: current.id, title: current.name, artist: current.artists?.map((entry) => entry.name).join(", ") ?? "", artwork: current.album?.images?.[0]?.url, durationMs: duration });
    setPositionMs(position);
    setDurationMs(duration);
    window.dispatchEvent(new CustomEvent("horizon:spotify-state", { detail: { trackId: current.id, positionMs: position, durationMs: duration, paused: state.paused } }));
  }, []);

  useEffect(() => {
    const clearDisconnectedPlayback = () => {
      if (!spotifyConnected()) {
        setTrack(null);
        setPositionMs(0);
        setDurationMs(0);
        setPaused(true);
        queuedRequestRef.current = null;
      }
    };
    window.addEventListener("horizon:spotify-connection-changed", clearDisconnectedPlayback);
    window.addEventListener("storage", clearDisconnectedPlayback);
    return () => {
      window.removeEventListener("horizon:spotify-connection-changed", clearDisconnectedPlayback);
      window.removeEventListener("storage", clearDisconnectedPlayback);
    };
  }, []);

  const playSpotifyTrack = useCallback(async (request: SpotifyRequest) => {
    setError("");
    if (!spotifyConnected()) {
      const returnTo = request.returnTo || `${window.location.pathname}${window.location.search}`;
      router.push(`/settings?returnTo=${encodeURIComponent(returnTo)}`);
      return;
    }
    const player = playerRef.current;
    if (player) void player.activateElement().catch(() => undefined);
    const token = await spotifyAccessToken();
    if (!token) {
      setError("Reconnect Spotify in Settings to continue.");
      return;
    }
    if (!deviceRef.current || !player) {
      queuedRequestRef.current = request;
      return;
    }
    try {
      const isAlbum = request.kind === "album" || request.uri?.startsWith("spotify:album:");
      const market = /^[A-Z]{2}$/.test(request.market ?? "") ? request.market! : "US";
      let match: SpotifyTrack | undefined;
      if (request.uri) {
        match = { uri: request.uri, name: request.title, artists: request.artist ? [{ name: request.artist }] : [], album: { images: request.artwork ? [{ url: request.artwork }] : [] } };
      } else {
        const query = [isAlbum ? `album:${request.album || request.title}` : request.title, request.artist && `artist:${request.artist}`, !isAlbum && request.album && `album:${request.album}`].filter(Boolean).join(" ");
        const search = await fetch(`https://api.spotify.com/v1/search?${new URLSearchParams({ q: query, type: isAlbum ? "album" : "track", limit: "1", market })}`, { headers: { authorization: `Bearer ${token}` } });
        if (!search.ok) throw new Error("Spotify search failed.");
        const result = await search.json() as { tracks?: { items?: SpotifyTrack[] }; albums?: { items?: SpotifyTrack[] } };
        match = isAlbum ? result.albums?.items?.[0] : result.tracks?.items?.[0];
      }
      if (!match?.uri) {
        setError(`Spotify couldn’t find this ${isAlbum ? "album" : "song"}.`);
        return;
      }
      await player.activateElement().catch(() => undefined);
      const response = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${encodeURIComponent(deviceRef.current)}`, {
        method: "PUT",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify(isAlbum ? { context_uri: match.uri } : { uris: [match.uri] }),
      });
      if (!response.ok) {
        setError(response.status === 403 ? "Spotify Premium is required for full-track playback." : "Spotify couldn’t start playback.");
        return;
      }
      // The SDK supplies the album's actual first song, including its lyrics ID.
      if (isAlbum) return;
      setTrack({ id: match.id ?? match.uri.split(":").at(-1), title: match.name || request.title, artist: match.artists?.map((entry) => entry.name).join(", ") || request.artist || "", artwork: match.album?.images?.[0]?.url || request.artwork, durationMs: match.duration_ms ?? 0 });
      setPositionMs(0);
      setDurationMs(match.duration_ms ?? 0);
      setPaused(false);
    } catch {
      setError("Spotify is temporarily unavailable.");
    }
  }, [router]);

  useEffect(() => {
    function receive(event: Event) {
      const detail = (event as CustomEvent<SpotifyRequest>).detail;
      if (detail?.title) void playSpotifyTrack(detail);
    }
    window.addEventListener("horizon:spotify-play", receive);
    return () => window.removeEventListener("horizon:spotify-play", receive);
  }, [playSpotifyTrack]);

  useEffect(() => {
    if (!connected) return;
    const stored = sessionStorage.getItem("horizon-spotify-pending-track");
    if (!stored) return;
    sessionStorage.removeItem("horizon-spotify-pending-track");
    try {
      const pending = JSON.parse(stored) as { request?: SpotifyRequest; createdAt?: number };
      if (pending.request?.title && Date.now() - (pending.createdAt ?? 0) < 10 * 60 * 1000) {
        window.dispatchEvent(new CustomEvent("horizon:spotify-play", { detail: pending.request }));
      }
    } catch { /* Ignore an incomplete pending playback request. */ }
  }, [connected, playSpotifyTrack]);

  useEffect(() => {
    if (!connected) return;
    let disposed = false;
    let initialized = false;
    const initialize = async () => {
      if (disposed || initialized || !window.Spotify) return;
      initialized = true;
      const player = new window.Spotify.Player({
        name: "Horizon Web Player",
        volume: 0.8,
        getOAuthToken: async (callback) => callback(await spotifyAccessToken() ?? ""),
      });
      player.addListener("ready", ((value: unknown) => {
        deviceRef.current = (value as SpotifyDevice).device_id;
        const queued = queuedRequestRef.current;
        queuedRequestRef.current = null;
        if (queued) void playSpotifyTrack(queued);
        void player.getCurrentState().then(syncFromPlayer);
      }) as never);
      player.addListener("not_ready", (() => { deviceRef.current = ""; }) as never);
      player.addListener("player_state_changed", ((value: unknown) => syncFromPlayer(value as PlayerState | null)) as never);
      player.addListener("account_error", (() => setError("Spotify Premium is required for full-track playback.")) as never);
      player.addListener("initialization_error", (() => setError("This browser couldn’t start Spotify playback.")) as never);
      playerRef.current = player;
      await player.connect();
    };
    const requestState = () => { void playerRef.current?.getCurrentState().then(syncFromPlayer); };
    window.addEventListener("horizon:spotify-request-state", requestState);
    window.onSpotifyWebPlaybackSDKReady = () => { void initialize(); };
    if (window.Spotify) void initialize();
    else if (!document.getElementById("spotify-web-playback-sdk")) {
      const script = document.createElement("script");
      script.id = "spotify-web-playback-sdk";
      script.src = "https://sdk.scdn.co/spotify-player.js";
      script.async = true;
      document.body.appendChild(script);
    }
    return () => {
      disposed = true;
      window.removeEventListener("horizon:spotify-request-state", requestState);
      playerRef.current?.disconnect();
      playerRef.current = null;
      deviceRef.current = "";
    };
  }, [connected, playSpotifyTrack, syncFromPlayer]);

  useEffect(() => {
    if (!track?.id || paused) return;
    const timer = window.setInterval(() => { void playerRef.current?.getCurrentState().then(syncFromPlayer); }, 500);
    return () => window.clearInterval(timer);
  }, [track?.id, paused, syncFromPlayer]);

  useEffect(() => {
    if (!error) return;
    const timer = window.setTimeout(() => setError(""), 6500);
    return () => window.clearTimeout(timer);
  }, [error]);

  async function control(action: "play" | "pause" | "next" | "previous") {
    const player = playerRef.current;
    if (!player) return;
    try {
      if (action === "play" || action === "pause") await player.togglePlay();
      if (action === "next") await player.nextTrack();
      if (action === "previous") await player.previousTrack();
    } catch {
      setError("Spotify playback controls are unavailable right now.");
    }
  }

  async function seek(position: number) {
    setPositionMs(position);
    try { await playerRef.current?.seek(position); }
    catch { setError("Spotify couldn’t seek this track."); }
  }

  if (!track) return error ? <div role="status" className="fixed bottom-[calc(5.1rem+env(safe-area-inset-bottom))] left-3 z-40 max-w-[min(22rem,calc(100vw-1.5rem))] rounded-xl border border-rose-100/15 bg-slate-950/90 px-3 py-2 text-xs text-rose-100 shadow-xl sm:left-5">{error}</div> : null;
  return <aside aria-label="Spotify mini player" className="fixed bottom-[calc(5.1rem+env(safe-area-inset-bottom))] left-3 z-40 w-[min(22rem,calc(100vw-1.5rem))] 2xl:bottom-[calc(1.25rem+env(safe-area-inset-bottom))] sm:left-5">
    <div className="glass rounded-2xl border border-white/15 bg-slate-950/65 p-3 shadow-2xl shadow-black/40 backdrop-blur-2xl sm:p-3.5">
      <div className="flex items-center gap-2.5">
        {track.artwork ? <Image src={track.artwork} alt="" width={44} height={44} sizes="44px" className="size-11 shrink-0 rounded-lg object-cover" /> : <div className="grid size-11 shrink-0 place-items-center rounded-lg bg-emerald-100/10 text-emerald-100"><Disc3 size={22}/></div>}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">{track.title}</p>
          <p className="truncate text-xs text-white/60">{track.artist}</p>
        </div>
      </div>
      <div className="mt-1 flex items-center justify-center gap-2">
        <button type="button" aria-label="Previous track" onClick={() => void control("previous")} className="grid size-8 place-items-center rounded-full text-white/75 hover:bg-white/10 hover:text-white"><SkipBack size={16} fill="currentColor" /></button>
        <button type="button" aria-label={paused ? "Play" : "Pause"} onClick={() => void control(paused ? "play" : "pause")} className="grid size-9 place-items-center rounded-full bg-white text-slate-950"><span>{paused ? <Play size={15} fill="currentColor" /> : <Pause size={15} fill="currentColor" />}</span></button>
        <button type="button" aria-label="Next track" onClick={() => void control("next")} className="grid size-8 place-items-center rounded-full text-white/75 hover:bg-white/10 hover:text-white"><SkipForward size={16} fill="currentColor" /></button>
      </div>
      <div className="mt-1 flex items-center gap-2 text-[10px] tabular-nums text-white/65">
        <input aria-label="Song progress" type="range" min={0} max={Math.max(durationMs, 1)} value={Math.min(positionMs, durationMs || positionMs)} onChange={(event) => void seek(Number(event.target.value))} className="h-1 min-w-0 flex-1 cursor-pointer" />
        <span aria-label="Elapsed time and song duration">{formatTime(positionMs)}/{formatTime(durationMs)}</span>
        {track.id && <Link aria-label="Open full page lyrics" href={`/music/tracks/${track.id}`} className="inline-flex items-center gap-1 rounded-md px-1 py-1 text-white/65 transition hover:text-white/90"><FileText size={13}/><span className="sr-only">Lyrics</span></Link>}
      </div>
      {error && <p role="status" className="mt-2 text-[10px] leading-4 text-rose-100/85">{error}</p>}
    </div>
  </aside>;
}
