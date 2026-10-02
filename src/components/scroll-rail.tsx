"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function ScrollRail({ children, label, className = "", trackClassName = "" }: { children: ReactNode; label: string; className?: string; trackClassName?: string }) {
  const track = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });
  useEffect(() => {
    const node = track.current;
    if (!node) return;
    const update = () => setEdges({ left: node.scrollLeft > 2, right: node.scrollLeft + node.clientWidth < node.scrollWidth - 2 });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    for (const child of node.children) observer.observe(child);
    node.addEventListener("scroll", update, { passive: true });
    return () => { observer.disconnect(); node.removeEventListener("scroll", update); };
  }, [children]);
  function scroll(direction: number) {
    const node = track.current;
    node?.scrollBy({ left: direction * node.clientWidth * .8, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  }
  return <div className={`scroll-rail ${className}`}>
    <button type="button" className="rail-arrow rail-left" aria-label={`Scroll ${label} left`} disabled={!edges.left} onClick={() => scroll(-1)}><ChevronLeft size={20}/></button>
    <div ref={track} className={`scroll-rail-track ${trackClassName}`} tabIndex={0} role="region" aria-label={label} onKeyDown={(event) => { if (event.target !== event.currentTarget) return; if (event.key === "ArrowLeft" || event.key === "ArrowRight") { event.preventDefault(); scroll(event.key === "ArrowLeft" ? -1 : 1); } }}>{children}</div>
    <button type="button" className="rail-arrow rail-right" aria-label={`Scroll ${label} right`} disabled={!edges.right} onClick={() => scroll(1)}><ChevronRight size={20}/></button>
  </div>;
}
