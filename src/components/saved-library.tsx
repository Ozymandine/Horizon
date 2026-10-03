"use client";

import { useState } from "react";
import Link from "next/link";
import { MediaArtwork } from "@/components/media-artwork";
import { RemoveFromListButton } from "@/components/remove-from-list-button";
import { ReviewForm } from "@/components/review-form";

export type SavedRelease = {
  id: string; title: string; type: "MOVIE" | "SHOW" | "GAME" | "MUSIC" | "EVENT";
  displayDate: string; posterUrl: string | null; href: string; isTracked: boolean; isCompleted: boolean;
  review: { rating: number; comment: string | null } | null;
  lists: { id: string; name: string }[];
};

const types = { MOVIE: "Movie", SHOW: "Show", GAME: "Game", MUSIC: "Music", EVENT: "Event" };
export function SavedLibrary({ items, lists }: { items: SavedRelease[]; lists: { id: string; name: string }[] }) {
  const [filter, setFilter] = useState("all");
  const [list, setList] = useState("");
  const groups = [
    { id: "all", label: "All saved", count: items.length },
    { id: "following", label: "Following", count: items.filter((item) => item.isTracked).length },
    { id: "reviewed", label: "Reviewed", count: items.filter((item) => item.review).length },
    { id: "unreviewed", label: "Not reviewed", count: items.filter((item) => !item.review).length },
  ];
  const visible = items.filter((item) => (!list || item.lists.some((entry) => entry.id === list)) && (filter === "all" || filter === "following" && item.isTracked || filter === "reviewed" && item.review || filter === "unreviewed" && !item.review));
  return <section className="saved-library" aria-label="Saved releases">
    <div className="library-toolbar">
      <div className="library-filters" role="group" aria-label="Saved release status">{groups.map((group) => <button key={group.id} type="button" aria-pressed={filter === group.id} onClick={() => setFilter(group.id)}>{group.label}<span>{group.count}</span></button>)}</div>
      {lists.length > 0 && <label className="library-list-filter"><span>List</span><select value={list} onChange={(event) => setList(event.target.value)} aria-label="Filter by list"><option value="">All lists</option>{lists.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label>}
    </div>
    <p className="library-count" role="status">{visible.length} {visible.length === 1 ? "release" : "releases"}{list ? ` in ${lists.find((entry) => entry.id === list)?.name}` : ""}</p>
    {visible.length ? <div className="library-grid">{visible.map((item) => <article key={item.id} className="library-card glass">
      <Link href={`${item.href}?returnTo=%2Fmy-list`} aria-label={`Open ${item.title}`} className="library-art" data-square={item.type === "MUSIC"}>
        <MediaArtwork title={item.title} type={item.type} imageUrl={item.posterUrl}/>
        <div className="library-art-shade"/><div className="library-art-copy"><span>{types[item.type]}</span><h2>{item.title}</h2><p>{item.displayDate}</p></div>
      </Link>
      <div className="library-statuses">
        {item.isTracked && <span className="status-following">Following</span>}
        {item.isCompleted && <span>Completed</span>}
        <span className={item.review ? "status-reviewed" : "status-unreviewed"}>{item.review ? `Reviewed · ★ ${item.review.rating}/5` : "Not reviewed"}</span>
      </div>
      <p className="library-membership">{item.lists.length ? `In ${item.lists.map((entry) => entry.name).join(" · ")}` : "No list assigned"}</p>
      <div className="library-actions">
        <details><summary>{item.review ? "Edit review" : "Rate & review"}</summary><div className="library-review"><ReviewForm entityId={item.id} initialRating={item.review?.rating} initialComment={item.review?.comment}/></div></details>
        {item.isTracked && <RemoveFromListButton entityId={item.id} label="Unfollow"/>}
      </div>
    </article>)}</div> : <div className="glass rounded-2xl p-7 text-sm text-white/65">No releases match this selection.<button type="button" className="ml-3 text-cyan-100" onClick={() => { setFilter("all"); setList(""); }}>Show all saved</button></div>}
  </section>;
}
