"use client";

import { useState } from "react";

type ArtworkType = "MOVIE" | "SHOW" | "GAME" | "MUSIC" | "EVENT";

const artworkTone: Record<ArtworkType, { label: string; gradient: string }> = {
  MOVIE: { label: "FILM", gradient: "from-sky-900 via-slate-900 to-black" },
  SHOW: { label: "SERIES", gradient: "from-blue-950 via-slate-900 to-black" },
  GAME: { label: "GAME", gradient: "from-violet-950 via-slate-900 to-black" },
  MUSIC: { label: "MUSIC", gradient: "from-amber-950 via-slate-900 to-black" },
  EVENT: { label: "EVENT", gradient: "from-rose-950 via-slate-900 to-black" },
};

export function MediaArtwork({ title, type, imageUrl, fallbackUrls = [], className = "" }: {
  title: string;
  type: ArtworkType;
  imageUrl?: string | null;
  fallbackUrls?: string[];
  className?: string;
}) {
  const urls = [imageUrl, ...fallbackUrls].filter((url): url is string => Boolean(url));
  const [imageIndex, setImageIndex] = useState(0);
  const tone = artworkTone[type];

  if (urls[imageIndex]) {
    return <img key={urls[imageIndex]} src={urls[imageIndex]} alt="" aria-hidden="true" onError={() => setImageIndex((current) => current + 1)} className={`h-full w-full object-cover ${className}`} />;
  }

  return (
    <div aria-label={`${title} artwork`} className={`relative grid h-full w-full place-items-center overflow-hidden bg-gradient-to-br ${tone.gradient} ${className}`}>
      <div aria-hidden="true" className="absolute -right-8 -top-10 size-40 rounded-full border border-white/10" />
      <div aria-hidden="true" className="absolute -bottom-16 -left-12 size-52 rounded-full border border-white/10" />
      <div className="relative flex h-full w-full flex-col justify-between p-4">
        <span className="text-[9px] font-semibold tracking-[.22em] text-white/70">{tone.label}</span>
        <div>
          <span className="mb-2 block h-px w-8 bg-white/50" />
          <span className="line-clamp-4 text-sm font-semibold leading-tight text-white">{title}</span>
          <span className="mt-3 block text-[8px] font-medium tracking-[.2em] text-white/45">HORIZON RELEASE RADAR</span>
        </div>
      </div>
    </div>
  );
}
