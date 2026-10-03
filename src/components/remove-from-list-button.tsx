"use client";

import { useState, useTransition } from "react";
import { removeFromTimeline } from "@/app/actions/list";

export function RemoveFromListButton({ entityId, label = "Remove" }: { entityId: string; label?: string }) {
  const [pending, startTransition] = useTransition();
  const [removed, setRemoved] = useState(false);
  const [error, setError] = useState("");
  return (
    <span className="flex flex-col items-end gap-1">
      <button type="button" disabled={pending || removed} onClick={() => startTransition(async () => {
        const result = await removeFromTimeline(entityId);
        if (result.ok) setRemoved(true);
        else setError(result.message ?? "Could not remove this release.");
      })} className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-2 text-xs text-slate-400 transition hover:border-rose-200/20 hover:text-rose-100 disabled:opacity-60">
        {pending ? "Removing…" : removed ? "Removed" : label}
      </button>
      {error && <span role="status" className="max-w-48 text-right text-[10px] text-rose-200">{error}</span>}
    </span>
  );
}
