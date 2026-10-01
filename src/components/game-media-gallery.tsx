"use client";

import Image from "next/image";
import { useRef, useState, type KeyboardEvent } from "react";
import { ChevronLeft, ChevronRight, Expand, Gamepad2, Play, X } from "lucide-react";
import styles from "./game-detail.module.css";

export type GameGalleryMedia = {
  kind: "image" | "video";
  name: string;
  image: string;
  webm?: string | null;
  mp4?: string | null;
};

function GalleryImage({ src, alt, thumbnail = false }: { src: string; alt: string; thumbnail?: boolean }) {
  const [failed, setFailed] = useState(false);
  return src && !failed ? <Image src={src} alt={alt} fill loading={thumbnail ? "lazy" : "eager"} sizes={thumbnail ? "140px" : "(max-width: 900px) 100vw, 850px"} className={thumbnail ? styles.thumbnailImage : styles.previewImage} onError={() => setFailed(true)} /> : <div className={styles.mediaFallback}><Gamepad2 aria-hidden="true" size={thumbnail ? 22 : 52} /><span>{thumbnail ? "" : "Artwork unavailable"}</span></div>;
}

function MediaPreview({ media, title }: { media: GameGalleryMedia; title: string }) {
  if (media.kind === "video") return <video key={media.webm ?? media.mp4} controls playsInline preload="none" poster={media.image || undefined} className={styles.previewVideo} aria-label={`${title}: ${media.name}`}>
    {media.webm && <source src={media.webm} type="video/webm" />}
    {media.mp4 && <source src={media.mp4} type="video/mp4" />}
    Your browser cannot play this trailer.
  </video>;
  return <GalleryImage key={media.image} src={media.image} alt={`${title}: ${media.name}`} />;
}

export function GameMediaGallery({ title, media }: { title: string; media: GameGalleryMedia[] }) {
  const [selected, setSelected] = useState(0);
  const thumbnails = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const selectedIndex = Math.min(selected, Math.max(0, media.length - 1));
  const current = media[selectedIndex];

  function select(index: number) {
    const next = (index + media.length) % media.length;
    setSelected(next);
    const button = thumbnails.current?.querySelector<HTMLButtonElement>(`[data-media-index="${next}"]`);
    button?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "nearest", inline: "nearest" });
  }

  function keyboard(event: KeyboardEvent<HTMLElement>) {
    if ((event.target as HTMLElement).tagName === "VIDEO" || media.length < 2) return;
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      select(selectedIndex + (event.key === "ArrowLeft" ? -1 : 1));
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      select(event.key === "Home" ? 0 : media.length - 1);
    }
  }

  if (!current) return <div className={styles.gallery}><div className={styles.preview}><div className={styles.mediaFallback}><Gamepad2 aria-hidden="true" size={52} /><p>No screenshots or trailers are available yet.</p></div></div></div>;

  return <section className={styles.gallery} aria-label={`${title} screenshots and trailers`} onKeyDown={keyboard}>
    <div className={styles.preview}>
      <MediaPreview media={current} title={title} />
      {current.kind === "image" && <button type="button" className={styles.expandButton} aria-label="Expand screenshot" onClick={() => dialog.current?.showModal()}><Expand size={18} /></button>}
      {media.length > 1 && current.kind === "image" && <><button type="button" className={`${styles.previewArrow} ${styles.previousArrow}`} onClick={() => select(selectedIndex - 1)} aria-label="Previous screenshot or trailer"><ChevronLeft size={22} /></button><button type="button" className={`${styles.previewArrow} ${styles.nextArrow}`} onClick={() => select(selectedIndex + 1)} aria-label="Next screenshot or trailer"><ChevronRight size={22} /></button></>}
    </div>
    <div className={styles.galleryCaption}><span>{current.name}</span><span aria-live="polite" aria-atomic="true">{selectedIndex + 1} / {media.length}</span></div>
    {media.length > 1 && <div className={styles.thumbnailRow}>
      <button type="button" className={styles.stripArrow} onClick={() => select(selectedIndex - 1)} aria-label="Previous media"><ChevronLeft size={18} /></button>
      <div ref={thumbnails} className={styles.thumbnails}>
        {media.map((entry, index) => <button key={`${entry.kind}:${entry.image}:${index}`} type="button" data-media-index={index} aria-label={`${entry.kind === "video" ? "Watch" : "Show"} ${entry.name}`} aria-pressed={index === selectedIndex} className={`${styles.thumbnail} ${index === selectedIndex ? styles.selectedThumbnail : ""}`} onClick={() => select(index)}><GalleryImage src={entry.image} alt="" thumbnail />{entry.kind === "video" && <span className={styles.trailerBadge}><Play size={16} fill="currentColor" aria-hidden="true" /><span className="sr-only">Trailer</span></span>}</button>)}
      </div>
      <button type="button" className={styles.stripArrow} onClick={() => select(selectedIndex + 1)} aria-label="Next media"><ChevronRight size={18} /></button>
    </div>}
    <dialog ref={dialog} className={styles.lightbox} aria-label={`${title} expanded screenshot`} onClick={(event) => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
      <button type="button" className={styles.lightboxClose} onClick={() => dialog.current?.close()} aria-label="Close expanded screenshot"><X size={22} /></button>
      <div className={styles.lightboxMedia}><MediaPreview media={current} title={title} /></div>
      <div className={styles.lightboxControls}><button type="button" className={styles.stripArrow} onClick={() => select(selectedIndex - 1)} aria-label="Previous media"><ChevronLeft size={22} /></button><span>{current.name} · {selectedIndex + 1} / {media.length}</span><button type="button" className={styles.stripArrow} onClick={() => select(selectedIndex + 1)} aria-label="Next media"><ChevronRight size={22} /></button></div>
    </dialog>
  </section>;
}
