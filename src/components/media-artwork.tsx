"use client";

import { useState } from "react";
import Image from "next/image";

type ArtworkType = "MOVIE" | "SHOW" | "GAME" | "MUSIC" | "EVENT";

const artworkTone: Record<ArtworkType, { label: string; symbol: string; gradient: string }> = {
  MOVIE: { label: "FILM", symbol: "▣", gradient: "from-sky-900 via-slate-900 to-black" },
  SHOW: { label: "SERIES", symbol: "▤", gradient: "from-blue-950 via-slate-900 to-black" },
  GAME: { label: "GAME", symbol: "⌘", gradient: "from-violet-950 via-slate-900 to-black" },
  MUSIC: { label: "MUSIC", symbol: "♫", gradient: "from-amber-950 via-slate-900 to-black" },
  EVENT: { label: "EVENT", symbol: "✦", gradient: "from-rose-950 via-slate-900 to-black" },
};

export function MediaArtwork({ title, type, imageUrl, fallbackUrls = [], className = "", priority = false, sizes = "(max-width: 640px) 50vw, 205px", quality = 75, unoptimized = true }: {
  title: string;
  type: ArtworkType;
  imageUrl?: string | null;
  fallbackUrls?: string[];
  className?: string;
  priority?: boolean;
  sizes?: string;
  quality?: number;
  unoptimized?: boolean;
}) {
  const urls = [...new Set([imageUrl, ...fallbackUrls].filter((url): url is string => Boolean(url)))];
  const [imageIndex, setImageIndex] = useState(0);
  const tone = artworkTone[type];

  if (urls[imageIndex]) {
    return <Image key={urls[imageIndex]} src={urls[imageIndex]} alt="" aria-hidden="true" fill loading={priority ? "eager" : "lazy"} fetchPriority={priority ? "high" : "auto"} unoptimized={unoptimized} sizes={sizes} quality={quality} onLoad={(event) => {
      const image = event.currentTarget;
      const minWidth = type === "GAME" ? 180 : 240;
      const minHeight = type === "GAME" ? 70 : 240;
      if (image.naturalWidth < minWidth || image.naturalHeight < minHeight) setImageIndex((current) => current + 1);
    }} onError={() => setImageIndex((current) => current + 1)} className={`object-cover ${className}`} />;
  }

  return (
    <div aria-label={`${title} artwork`} className={`relative grid h-full w-full place-items-center overflow-hidden bg-gradient-to-br ${tone.gradient} ${className}`}>
      <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_15%,rgba(255,255,255,.12),transparent_55%)]" />
      <div className="relative flex max-w-full flex-col items-center gap-4 p-4 text-center">
        <span aria-hidden="true" className="grid size-14 place-items-center rounded-2xl border border-white/15 bg-black/15 text-3xl text-white/75">{tone.symbol}</span>
        <span className="text-[9px] font-semibold tracking-[.22em] text-white/60">{tone.label}</span>
      </div>
    </div>
  );
}
