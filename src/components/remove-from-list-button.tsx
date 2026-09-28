"use client";

import { useState, useTransition } from "react";
import { Check, X } from "lucide-react";
import { removeFromTimeline } from "@/app/actions/list";

export function RemoveFromListButton({ entityId }: { entityId: string }) {
  const [pending, startTransition] = useTransition();
  const [removed, setRemoved] = useState(false);
  return (
    <button type="button" disabled={pending || removed} onClick={() => startTransition(async () => {
      const result = await removeFromTimeline(entityId);
      if (result.ok) setRemoved(true);
    })} className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-2 text-xs text-slate-400 transition hover:border-rose-200/20 hover:text-rose-100 disabled:opacity-60">
      {removed ? <Check size={13} /> : <X size={13} />}{pending ? "Removing…" : removed ? "Removed" : "Remove"}
    </button>
  );
}
