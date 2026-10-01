"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUpRight, ChevronLeft, ChevronRight, Pause, Play, Star } from "lucide-react";
import type { RadarItem } from "@/lib/radar";
import { AddToMyListMenu } from "@/components/add-to-my-list-menu";
import { spotifyConnected } from "@/lib/spotify-auth";

function playbackRequestTime() { return Date.now(); }

export function detailLink(item: RadarItem, returnTo: string) {
  return `${item.href}${item.href.includes("?") ? "&" : "?"}returnTo=${encodeURIComponent(returnTo)}`;
}
export function CinematicHero({ items, returnTo, onFeature, market = "US" }: { items: RadarItem[]; returnTo: string; onFeature: (image: string | null) => void; market?: string }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [focused, setFocused] = useState(false);
  const router = useRouter();
  const slides = items.filter((item) => item.backdropUrl || item.posterUrl).slice(0, 6);
  const activeIndex = slides.length ? index % slides.length : 0;
  const item = slides[activeIndex];
  const image = (item?.backdropUrl ?? item?.posterUrl)?.replace("/original/", "/w780/") ?? null;
  const callback = useRef(onFeature);
  useEffect(() => { callback.current = onFeature; }, [onFeature]);
  useEffect(() => { callback.current(image); }, [image]);
  useEffect(() => {
    const match = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(match.matches);
    update(); match.addEventListener("change", update);
    return () => match.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (paused || hovered || reduced || focused || slides.length < 2) return;
    const timer = window.setInterval(() => { if (!document.hidden) setIndex((value) => (value + 1) % slides.length); }, 8500);
    return () => window.clearInterval(timer);
  }, [paused, hovered, reduced, focused, slides.length]);
  function playMusic() {
    if (!item) return;
    const request = { title: item.title, artist: item.artistName ?? "", artwork: item.posterUrl ?? undefined, kind: item.source === "apple-song" ? "track" : "album", market, returnTo };
    if (!spotifyConnected()) {
      sessionStorage.setItem("horizon-spotify-pending-track", JSON.stringify({ request, createdAt: playbackRequestTime() }));
      router.push(`/settings?returnTo=${encodeURIComponent(returnTo)}`);
    } else window.dispatchEvent(new CustomEvent("horizon:spotify-play", { detail: request }));
  }
  return <section className={`cinematic-hero ${item?.type === "MUSIC" ? "cinematic-hero-music" : ""}`} aria-roledescription="carousel" aria-label="Featured titles" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onFocusCapture={() => setFocused(true)} onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}>
    {slides.map((slide, slideIndex) => <div key={`${slide.source}:${slide.sourceId}`} className="hero-scene" data-active={slideIndex === activeIndex} aria-hidden="true">
      <Image src={(slide.backdropUrl ?? slide.posterUrl!).replace("/original/", "/w1280/")} alt="" fill loading={slideIndex === activeIndex ? "eager" : "lazy"} fetchPriority={slideIndex === activeIndex ? "high" : "auto"} sizes="100vw" className="hero-art" />
    </div>)}
    <div className="hero-shade" aria-hidden="true" />
    {item ? <div key={`${item.source}:${item.sourceId}`} className="hero-copy">
      <p className="hero-eyebrow"><span/>{item.type === "MUSIC" ? "In the spotlight" : "Featured on Horizon"}</p>
      {item.type === "MUSIC" && item.posterUrl && <div className="hero-album"><Image src={item.posterUrl} alt={`${item.title} cover`} fill loading="eager" sizes="160px" className="object-cover"/></div>}
      <h1>{item.title}</h1>
      <div className="hero-metadata">{item.voteAverage ? <span><Star size={14} fill="currentColor"/>{item.voteAverage.toFixed(1)}<span className="opacity-50">/{item.ratingScale ?? 10}</span></span> : null}<span>{item.displayDate}</span>{item.artistName && <span>{item.artistName}</span>}{item.tags?.[0] && <span>{item.tags[0]}</span>}</div>
      <p className="hero-description">{item.description === "Steam game listing." ? "Find your next favorite game. Explore trailers, screenshots, and everything you need to know." : item.description}</p>
      <div className="hero-actions">
        {item.type === "MUSIC" && item.source !== "apple-artist" ? <button type="button" className="hero-primary" onClick={playMusic}><Play size={17} fill="currentColor"/>Play</button> : <Link className="hero-primary" href={detailLink(item, returnTo)}>{item.type === "GAME" ? "Explore game" : "Explore title"}<ArrowUpRight size={17}/></Link>}
        {item.type === "MUSIC" && <Link className="hero-secondary" href={detailLink(item, returnTo)}>View details</Link>}
        <AddToMyListMenu item={item}/>
      </div>
    </div> : <div className="hero-copy hero-placeholder" role="status"><p className="hero-eyebrow">Your next favorite is out there</p><h1>Make room<br/>for discovery.</h1><p className="hero-description">Bringing the spotlight to your screen…</p></div>}
    <div className="hero-bottom">
      <a href="#discover-collections" className="hero-scroll"><ArrowDown size={15}/><span>Scroll to explore</span></a>
      {slides.length > 1 && <div className="hero-pagination">
        <button type="button" aria-label="Previous featured title" onClick={() => setIndex((value) => (value + slides.length - 1) % slides.length)}><ChevronLeft size={17}/></button>
        {slides.map((slide, slideIndex) => <button key={`${slide.source}:${slide.sourceId}`} type="button" className="hero-dot" aria-label={`Feature ${slide.title}`} aria-current={slideIndex === activeIndex ? "true" : undefined} onClick={() => setIndex(slideIndex)}><span style={{ "--slide-duration": "8500ms" } as CSSProperties}/></button>)}
        <button type="button" aria-label="Next featured title" onClick={() => setIndex((value) => (value + 1) % slides.length)}><ChevronRight size={17}/></button>
        <button type="button" aria-label={paused ? "Resume featured slideshow" : "Pause featured slideshow"} aria-pressed={paused} onClick={() => setPaused((value) => !value)}>{paused ? <Play size={13}/> : <Pause size={13}/>}</button>
      </div>}
    </div>
  </section>;
}
export function CatalogAtmosphere() {
  return <div className="catalog-atmosphere" aria-hidden="true"><svg className="catalog-silk" viewBox="0 0 1440 1000" preserveAspectRatio="xMidYMid slice"><defs><filter id="horizon-silk-blur"><feGaussianBlur stdDeviation="22"/></filter><linearGradient id="horizon-silk-color"><stop stopColor="#7bccb4"/><stop offset=".4" stopColor="#325576"/><stop offset=".7" stopColor="#6a82ab"/><stop offset="1" stopColor="#133035"/></linearGradient></defs><g fill="none" stroke="url(#horizon-silk-color)" filter="url(#horizon-silk-blur)"><path className="silk-ribbon silk-one" strokeWidth="100" d="M-200 750C50-200 600 180 460 650S1050 1050 1170 50S1630-150 1600 900"/><path className="silk-ribbon silk-two" strokeWidth="60" d="M-250 200C650 950 650-50 1200 450S1600 950 1700 20"/><path className="silk-ribbon silk-three" strokeWidth="25" d="M-100 900C600 300 400 1100 750 750S1350 50 1600 600"/></g></svg><div className="atmosphere-grain"/></div>;
}
