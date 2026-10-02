"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { ScrollRail } from "@/components/scroll-rail";

export function FilmArtwork({ title, images }: { title: string; images: string[] }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [index, setIndex] = useState(0);
  function move(direction: number) { setIndex((value) => (value + direction + images.length) % images.length); }
  return <><ScrollRail label="artwork" trackClassName="film-artwork-track">{images.map((image, position) => <button key={image} type="button" className="film-artwork-thumbnail" aria-label={`Expand ${title} image ${position + 1}`} onClick={() => { setIndex(position); dialog.current?.showModal(); }}><Image src={image.replace("/w1280/", "/w500/")} alt="" fill sizes="240px" className="object-cover"/></button>)}</ScrollRail><dialog ref={dialog} className="film-artwork-dialog" aria-label={`${title} artwork`} onClick={(event) => { if (event.target === event.currentTarget) dialog.current?.close(); }} onKeyDown={(event) => { if (event.key === "ArrowLeft") move(-1); if (event.key === "ArrowRight") move(1); }}><button type="button" className="artwork-close" aria-label="Close artwork" onClick={() => dialog.current?.close()}><X size={20}/></button><div className="artwork-full-image"><Image src={images[index]} alt={`${title}, image ${index + 1}`} fill sizes="90vw" className="object-contain"/></div><div className="artwork-controls"><button type="button" aria-label="Previous artwork" onClick={() => move(-1)}><ChevronLeft/></button><span>{index + 1} / {images.length}</span><button type="button" aria-label="Next artwork" onClick={() => move(1)}><ChevronRight/></button></div></dialog></>;
}
