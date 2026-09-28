"use client";

import { useState, useTransition } from "react";
import { Check, Plus } from "lucide-react";
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
    <div className="mt-3">
      <button
        type="button"
        onClick={add}
        disabled={pending || state === "added"}
        aria-label={state === "added" ? `${item.title} added to timeline` : `Add ${item.title} to timeline`}
        className={`inline-flex items-center justify-center gap-1.5 rounded-full border px-3 py-2 text-xs font-medium transition disabled:cursor-default ${state === "added" ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-100" : "border-white/10 bg-white/[.04] text-slate-200 hover:border-white/20 hover:bg-white/10"} ${compact ? "w-full" : ""}`}
      >
        {state === "added" ? <Check size={14} /> : <Plus size={14} />}
        {pending ? "Adding…" : state === "added" ? "Added" : "Add to timeline"}
      </button>
      {state === "error" && <p role="status" className="mt-1.5 text-[11px] leading-4 text-rose-200">{message}</p>}
      {state === "added" && <span className="sr-only" role="status">{message}</span>}
    </div>
  );
}
