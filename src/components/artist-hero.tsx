"use client";

import { Play } from "lucide-react";
import { ArtistArtwork } from "@/components/artist-artwork";
import { useMusicPlayback, type PlayableTrack } from "@/components/music-track-list";

export function ArtistHero({ name, imageUrl, genre, tracks, returnTo }: { name: string; imageUrl?: string | null; genre?: string; tracks: PlayableTrack[]; returnTo: string }) {
  const play = useMusicPlayback(returnTo);
  return <header className="artist-hero">
    <div className="artist-hero-photo"><ArtistArtwork name={name} imageUrl={imageUrl} sizes="(max-width: 640px) 100vw, 850px" priority/></div>
    <div className="artist-hero-fade" aria-hidden="true"/>
    <div className="artist-hero-copy"><p>{genre || "Artist"}</p><h1>{name}</h1>
      {tracks[0] && <button type="button" onClick={() => play(tracks[0])} className="artist-play"><Play size={17} fill="currentColor"/>Play</button>}
    </div>
  </header>;
}
