"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { addItemToReleaseList, createReleaseListAndAdd, getReleaseLists } from "@/app/actions/list";
import type { RadarItem } from "@/lib/radar";

type ReleaseListOption = { id: string; name: string };

export function AddToMyListMenu({ item }: { item: RadarItem }) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [lists, setLists] = useState<ReleaseListOption[]>([]);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { setOpen(false); setCreating(false); trigger.current?.focus(); } };
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", escape);
    return () => { window.removeEventListener("pointerdown", close); window.removeEventListener("keydown", escape); };
  }, [open]);

  useEffect(() => {
    if (creating) input.current?.focus();
  }, [creating]);

  function showMenu() {
    setOpen((value) => !value);
    setCreating(false);
    setMessage("");
    startTransition(async () => setLists(await getReleaseLists()));
  }

  function addTo(list: ReleaseListOption) {
    setMessage("");
    startTransition(async () => {
      const result = await addItemToReleaseList(item, list.id);
      setMessage(result.ok ? `Added to ${result.listName}.` : result.message);
      if (result.ok) setOpen(false);
    });
  }

  function createList(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    startTransition(async () => {
      const result = await createReleaseListAndAdd(item, title);
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      setLists((current) => [...current, result.list].sort((a, b) => a.name.localeCompare(b.name)));
      setTitle("");
      setCreating(false);
      setOpen(false);
      setMessage(`Created ${result.list.name} and added this release.`);
    });
  }

  return (
    <div ref={root} className="relative">
      <button ref={trigger} type="button" onClick={showMenu} aria-expanded={open} className="detail-action">
        Add to My List
      </button>
      {open && <div className="glass absolute top-[calc(100%+10px)] left-0 z-30 min-w-56 overflow-hidden rounded-2xl p-1.5 shadow-2xl shadow-black/50">
        <button type="button" onClick={() => { setCreating(true); setMessage(""); }} className="block w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium text-white transition hover:bg-white/10">Create list</button>
        {lists.length > 0 && <div className="my-1 border-t border-white/10 pt-1">{lists.map((list) => <button key={list.id} type="button" disabled={pending} onClick={() => addTo(list)} className="block w-full truncate rounded-xl px-3 py-2.5 text-left text-sm text-slate-200 transition hover:bg-white/10 disabled:opacity-50">{list.name}</button>)}</div>}
        {!lists.length && <p className="px-3 pb-2 pt-1 text-xs text-slate-500">{pending ? "Loading lists…" : "Create a list to get started."}</p>}
      </div>}
      {creating && <div className="fixed inset-0 z-50 grid place-items-center bg-black/65 p-5 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) setCreating(false); }}>
        <form onSubmit={createList} className="glass w-full max-w-md rounded-3xl p-6 shadow-2xl shadow-black/60 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[.2em] text-cyan-100/70">My List</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Create a list</h2>
          <label className="mt-6 block text-sm text-slate-300" htmlFor="release-list-title">List title</label>
          <input ref={input} id="release-list-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={80} placeholder="e.g. Movie night" className="mt-2 w-full rounded-2xl border border-white/15 bg-black/25 px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-cyan-100/50" />
          {message && <p role="status" className="mt-3 text-sm text-rose-200">{message}</p>}
          <div className="mt-6 flex justify-end gap-2">
            <button type="button" onClick={() => { setCreating(false); setMessage(""); }} className="rounded-full px-4 py-2.5 text-sm text-slate-300 hover:bg-white/5">Cancel</button>
            <button type="submit" disabled={pending || !title.trim()} className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-50 disabled:opacity-50">{pending ? "Creating…" : "Create list"}</button>
          </div>
        </form>
      </div>}
      {message && !open && !creating && <p role="status" className="mt-2 text-xs text-emerald-100">{message}</p>}
    </div>
  );
}
