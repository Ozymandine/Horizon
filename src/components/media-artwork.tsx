"use client";

import { useState } from "react";

type ArtworkType = "MOVIE" | "SHOW" | "GAME" | "MUSIC" | "EVENT";

const artworkTone: Record<ArtworkType, { label: string; symbol: string; gradient: string }> = {
  MOVIE: { label: "FILM", symbol: "▣", gradient: "from-sky-900 via-slate-900 to-black" },
  SHOW: { label: "SERIES", symbol: "▤", gradient: "from-blue-950 via-slate-900 to-black" },
  GAME: { label: "GAME", symbol: "⌘", gradient: "from-violet-950 via-slate-900 to-black" },
  MUSIC: { label: "MUSIC", symbol: "♫", gradient: "from-amber-950 via-slate-900 to-black" },
  EVENT: { label: "EVENT", symbol: "✦", gradient: "from-rose-950 via-slate-900 to-black" },
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
    return <img key={urls[imageIndex]} src={urls[imageIndex]} alt="" aria-hidden="true" loading="lazy" decoding="async" onLoad={(event) => {
      const image = event.currentTarget;
      if (image.naturalWidth < 240 || image.naturalHeight < 240) setImageIndex((current) => current + 1);
    }} onError={() => setImageIndex((current) => current + 1)} className={`h-full w-full object-cover ${className}`} />;
  }

  return (
    <div aria-label={`${title} artwork`} className={`relative grid h-full w-full place-items-center overflow-hidden bg-gradient-to-br ${tone.gradient} ${className}`}>
      <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_15%,rgba(255,255,255,.12),transparent_55%)]" />
      <div className="relative flex max-w-full flex-col items-center gap-4 p-4 text-center">
        <span aria-hidden="true" className="grid size-14 place-items-center rounded-2xl border border-white/15 bg-black/15 text-3xl text-white/75">{tone.symbol}</span>
        <span className="text-[9px] font-semibold tracking-[.22em] text-white/60">{tone.label}</span>
        <span className="line-clamp-3 max-w-full text-sm font-medium leading-tight text-white/90">{title}</span>
      </div>
    </div>
  );
}
