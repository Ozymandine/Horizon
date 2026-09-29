"use client";

import { useState, useTransition } from "react";
import { addToTimeline } from "@/app/actions/list";
import type { RadarItem } from "@/lib/radar";

export function AddToTimelineButton({ item, compact = false }: { item: RadarItem; compact?: boolean }) {
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<"idle" | "added" | "error">("idle");
  const [message, setMessage] = useState("");

  function add() {
    startTransition(async () => {
      const result = await addToTimeline(item);
      setState(result.ok ? "added" : "error");
      setMessage(result.ok ? "Added to My List and timeline." : result.message);
    });
  }

  return (
    <div className={compact ? "mt-3" : "mt-0"}>
      <button
        type="button"
        onClick={add}
        disabled={pending || state === "added"}
        aria-label={state === "added" ? `${item.title} added to timeline` : `Add ${item.title} to timeline`}
        className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-full border px-5 py-3 text-sm font-medium transition disabled:cursor-default ${state === "added" ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-100" : "border-white/15 bg-white/[.08] text-white shadow-lg shadow-black/15 hover:border-white/30 hover:bg-white/15"} ${compact ? "w-full" : ""}`}
      >
        <span aria-hidden="true" className="text-xl leading-none">{pending ? "…" : state === "added" ? "✓" : "+"}</span>
        {pending ? "Adding…" : state === "added" ? "Added to timeline" : "Add to timeline"}
      </button>
      {state === "error" && <p role="status" className="mt-1.5 text-[11px] leading-4 text-rose-200">{message}</p>}
      {state === "added" && <span className="sr-only" role="status">{message}</span>}
    </div>
  );
}
