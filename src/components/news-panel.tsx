"use client";

import { useEffect, useState } from "react";
import { getGoogleNewsHeadlines, type HeadlinesResult } from "@/app/actions/news";

export function NewsPanel({ title, artist = "" }: { title: string; artist?: string }) {
  const [resultState, setResultState] = useState<{ key: string; result: HeadlinesResult } | null>(null);
  const key = `${title}\u0000${artist}`;

  useEffect(() => {
    let active = true;
    getGoogleNewsHeadlines(title, artist).then((data) => {
      if (active) setResultState({ key, result: data });
    });
    return () => { active = false; };
  }, [artist, key, title]);
  const result = resultState?.key === key ? resultState.result : null;

  return (
    <section className="glass rounded-3xl p-5 sm:p-7">
      <h2 className="mb-4 text-sm font-semibold text-white">Latest headlines</h2>
      {!result ? <p className="text-sm text-slate-500">Fetching recent coverage…</p> : !result.ok ? <p className="text-sm text-slate-500">Headlines are unavailable right now.</p> : result.headlines.length === 0 ? <p className="text-sm text-slate-500">No recent headlines found.</p> : (
        <ul className="space-y-3">
          {result.headlines.map((item) => (
            <li key={item.url}>
              <a href={item.url} target="_blank" rel="noreferrer" className="group flex items-start justify-between gap-4 rounded-xl bg-black/20 p-3 transition hover:bg-white/[.07]">
                <span>
                  <span className="block text-sm leading-5 text-slate-200 group-hover:text-white">{item.title}</span>
                  <span className="mt-1 block text-xs text-slate-500">{item.publisher ?? "Google News"}{item.publishedAt ? ` · ${new Date(item.publishedAt).toLocaleDateString()}` : ""}</span>
                </span>
                <span aria-hidden="true" className="mt-0.5 shrink-0 text-slate-500">↗</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
