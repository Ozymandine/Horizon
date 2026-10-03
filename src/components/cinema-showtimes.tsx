"use client";

import { useState } from "react";
import { ArrowUpRight, ChevronDown, MapPin, Ticket } from "lucide-react";

export function CinemaShowtimes({ title }: { title: string }) {
  const [location, setLocation] = useState("");
  const place = location.trim() || "me";
  const showtimes = `https://www.google.com/search?${new URLSearchParams({ q: `${title} movie showtimes near ${place}` })}`;
  const cinemas = `https://www.google.com/maps/search/?${new URLSearchParams({ api: "1", query: `movie theaters near ${place}` })}`;
  return <details className="cinema-showtimes mt-4 rounded-xl border border-white/15 bg-black/15">
    <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-3 text-sm font-medium text-white"><Ticket size={16}/><span className="flex-1">Find nearby screenings</span><ChevronDown size={14}/></summary>
    <div className="space-y-3 px-3 pb-3">
      <label className="block text-xs text-white/65" htmlFor="cinema-location">City or ZIP code</label>
      <div className="flex items-center gap-2 rounded-lg border border-white/20 px-3"><MapPin size={14} className="shrink-0 text-white/60"/><input id="cinema-location" value={location} onChange={(event) => setLocation(event.target.value)} maxLength={80} placeholder="Near me" className="min-w-0 w-full bg-transparent py-2.5 text-sm text-white outline-none" autoComplete="off"/></div>
      <a href={showtimes} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-lg bg-white px-3 py-2.5 text-sm font-medium text-black">Showtimes for this movie<ArrowUpRight size={15}/></a>
      <a href={cinemas} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-white/65 hover:text-white">Nearby cinemas<ArrowUpRight size={13}/></a>
    </div>
  </details>;
}
