"use client";

import { useMemo, useState } from "react";
import Image from "next/image";

type VideoPlayerProps = {
  videoKey: string;
  title: string;
  fallbackUrl?: string;
  posterUrl?: string | null;
};

export function VideoPlayer({ videoKey, title, fallbackUrl, posterUrl }: VideoPlayerProps) {
  const [playing, setPlaying] = useState(false);
  const safeKey = useMemo(() => /^[A-Za-z0-9_-]{6,32}$/.test(videoKey), [videoKey]);

  if (!safeKey) {
    return (
      <div className="glass flex aspect-video items-center justify-center rounded-2xl p-6 text-center text-sm text-slate-400">
        Trailer unavailable.
      </div>
    );
  }

  if (playing) {
    return (
      <div className="aspect-video overflow-hidden rounded-2xl border border-white/10 bg-black">
        <iframe
          className="h-full w-full"
          src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoKey)}?autoplay=1&rel=0`}
          title={`${title} trailer`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
        />
      </div>
    );
  }

  return (
    <div className="glass relative flex aspect-video items-center justify-center overflow-hidden rounded-2xl bg-black/25">
      {posterUrl && <Image src={posterUrl} alt="" fill sizes="(max-width: 1024px) 100vw, 850px" className="object-cover opacity-60"/>}
      <button
        type="button"
        onClick={() => setPlaying(true)}
        className="group relative flex items-center gap-3 rounded-full border border-white/15 bg-black/40 px-5 py-3 text-sm font-medium text-white backdrop-blur transition hover:bg-white/10"
      >
        <span className="grid size-9 place-items-center rounded-full bg-white text-slate-950 transition group-hover:scale-105">
          <span aria-hidden="true">▶</span>
        </span>
        Play trailer
      </button>
      {fallbackUrl && (
        <a href={fallbackUrl} target="_blank" rel="noreferrer" className="absolute right-4 bottom-4 inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white">
          Open source ↗
        </a>
      )}
    </div>
  );
}
