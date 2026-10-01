"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Play } from "lucide-react";
import { spotifyConnected } from "@/lib/spotify-auth";

function currentTimestamp() {
  return Date.now();
}

export type PlayableTrack = {
  title: string;
  artist?: string;
  album?: string;
  year?: string;
  artworkUrl?: string | null;
  href?: string;
  internalHref?: string;
  spotifyUri?: string;
  spotifyUrl?: string;
};

export function MusicTrackList({ tracks, returnTo }: { tracks: PlayableTrack[]; returnTo?: string }) {
  const router = useRouter();
  function play(track: PlayableTrack) {
    const destination = returnTo || `${window.location.pathname}${window.location.search}`;
    if (!spotifyConnected()) {
      sessionStorage.setItem("horizon-spotify-pending-track", JSON.stringify({
        request: { title: track.title, artist: track.artist ?? "", album: track.album ?? "", uri: track.spotifyUri, artwork: track.artworkUrl ?? undefined, returnTo: destination },
        createdAt: currentTimestamp(),
      }));
      router.push(`/settings?returnTo=${encodeURIComponent(destination)}`);
      return;
    }
    window.dispatchEvent(new CustomEvent("horizon:spotify-play", {
      detail: { title: track.title, artist: track.artist ?? "", album: track.album ?? "", uri: track.spotifyUri, artwork: track.artworkUrl ?? undefined, returnTo: destination },
    }));
  }

  if (!tracks.length) return <p className="glass rounded-2xl p-5 text-sm text-white/75">No track listings are available from the music catalog.</p>;

  return <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/15">
    {tracks.map((track, index) => <div key={`${track.spotifyUri ?? track.title}:${index}`} className="grid grid-cols-[2.5rem_2.75rem_minmax(0,1fr)] items-center gap-3 border-b border-white/[.07] px-3 py-2.5 last:border-b-0 sm:grid-cols-[2rem_2.75rem_2.75rem_minmax(0,1fr)] sm:px-4">
      <span className="hidden text-center text-xs tabular-nums text-white/40 sm:block">{index + 1}</span>
      <button type="button" aria-label={`Play ${track.title} in Horizon`} onClick={() => play(track)} className="grid size-9 place-items-center rounded-full text-white/80 transition hover:bg-white/10 hover:text-white"><Play size={16} fill="currentColor" /></button>
      {track.artworkUrl ? <Image src={track.artworkUrl} alt="" width={44} height={44} sizes="44px" className="size-10 rounded-lg object-cover sm:size-11" /> : <div aria-hidden="true" className="grid size-10 place-items-center rounded-lg bg-white/[.06] text-white/45 sm:size-11"><span>♫</span></div>}
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-white">{track.internalHref ? <Link href={`${track.internalHref}${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ""}`} className="hover:underline">{track.title}</Link> : track.href ? <Link href={`${track.href}${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ""}`} className="hover:underline">{track.title}</Link> : track.title}</p>
        <p className="truncate text-xs text-white/60">{[track.artist, track.album, track.year].filter(Boolean).join(" · ")}</p>
      </div>
    </div>)}
  </div>;
}
