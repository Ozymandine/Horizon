"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

const portraits = new Map<string, Promise<string | null>>();
function loadPortrait(id: string, country: string) {
  const key = `${country}:${id}`;
  if (!portraits.has(key)) portraits.set(key, fetch(`/api/music/artists/${id}/artwork?country=${country}`)
    .then(async (response) => response.ok ? (await response.json() as { portraitUrl?: string | null }).portraitUrl ?? null : null).catch(() => null));
  return portraits.get(key)!;
}

export function ArtistArtwork({ id, name, country = "US", imageUrl, sizes = "200px", priority = false }: { id?: string; name: string; country?: string; imageUrl?: string | null; sizes?: string; priority?: boolean }) {
  const container = useRef<HTMLDivElement>(null);
  const key = `${country}:${id}`;
  const [portrait, setPortrait] = useState<{ key: string; url: string | null } | null>(null);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const url = imageUrl || (portrait?.key === key ? portrait.url : null);
  useEffect(() => {
    if (imageUrl || !id || !container.current) return;
    let cancelled = false;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      void loadPortrait(id, country).then((url) => { if (!cancelled) setPortrait({ key, url }); });
    }, { rootMargin: "150px" });
    observer.observe(container.current);
    return () => { cancelled = true; observer.disconnect(); };
  }, [country, id, imageUrl, key]);
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => [...part][0]).join("").toUpperCase();
  return <div ref={container} className="artist-artwork">
    {url && url !== failedUrl ? <Image src={url} alt={`${name} artist portrait`} fill sizes={sizes} loading={priority ? "eager" : "lazy"} fetchPriority={priority ? "high" : "auto"} className="object-cover" onError={() => setFailedUrl(url)}/> : <span aria-label={name} className="artist-initials">{initials}</span>}
  </div>;
}
