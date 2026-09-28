"use client";

import { useState, useTransition, type FormEvent } from "react";
import { Check, Star } from "lucide-react";
import { saveReview } from "@/app/actions/list";

export function ReviewForm({ entityId, initialRating, initialComment }: {
  entityId: string;
  initialRating?: number | null;
  initialComment?: string | null;
}) {
  const [rating, setRating] = useState(initialRating ?? 0);
  const [comment, setComment] = useState(initialComment ?? "");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [saved, setSaved] = useState(false);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await saveReview(entityId, rating, comment);
      setSaved(result.ok);
      setMessage(result.ok ? "Review saved." : result.message);
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <fieldset>
        <legend className="mb-2 text-xs font-medium text-slate-400">Your rating</legend>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((value) => (
            <button key={value} type="button" onClick={() => { setRating(value); setSaved(false); }} aria-label={`Rate ${value} out of 5 stars`} aria-pressed={rating === value} className="rounded-md p-1 text-amber-300 transition hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-200">
              <Star size={21} className={value <= rating ? "fill-amber-300" : "text-slate-600"} />
            </button>
          ))}
        </div>
      </fieldset>
      <label className="block">
        <span className="sr-only">Review comment</span>
        <textarea value={comment} onChange={(event) => { setComment(event.target.value); setSaved(false); }} maxLength={4000} rows={3} placeholder="Add a note or review…" className="w-full resize-y rounded-2xl border border-white/10 bg-black/20 px-3.5 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-200/30" />
      </label>
      <div className="flex items-center justify-between gap-3">
        <p aria-live="polite" className={`text-xs ${saved ? "text-emerald-200" : "text-slate-500"}`}>{message || `${comment.length}/4000`}</p>
        <button type="submit" disabled={pending || rating < 1} className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-semibold text-slate-950 transition hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-40">
          {saved && <Check size={13} />}{pending ? "Saving…" : saved ? "Saved" : "Save review"}
        </button>
      </div>
    </form>
  );
}
