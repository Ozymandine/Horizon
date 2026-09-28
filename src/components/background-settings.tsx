"use client";

import { useEffect, useState } from "react";
import { applyBackground, backgroundOptions, type BackgroundId } from "@/lib/background-options";

export function BackgroundSettings() {
  const [active, setActive] = useState<BackgroundId>("obsidian");

  useEffect(() => {
    const saved = localStorage.getItem("horizon-background") ?? "obsidian";
    setActive(saved as BackgroundId);
    applyBackground(saved);
  }, []);

  return (
    <section className="mb-9">
      <div className="mb-3 flex items-end justify-between gap-4">
        <div><h2 className="font-medium text-white">Background</h2><p className="mt-1 text-xs text-slate-500">Choose the gradient behind your releases.</p></div>
        <span className="text-xs text-slate-400">{backgroundOptions.find((option) => option.id === active)?.label}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {backgroundOptions.map((option) => (
          <button key={option.id} type="button" aria-pressed={active === option.id} onClick={() => { setActive(option.id); applyBackground(option.id); }} className={`flex items-center gap-2 rounded-full border px-2 py-1.5 text-xs transition ${active === option.id ? "border-white/35 bg-white/10 text-white" : "border-white/10 bg-white/[.03] text-slate-400 hover:text-white"}`}>
            <span aria-hidden className="size-6 rounded-full border border-white/15" style={{ background: option.value }} />
            {option.label}
          </button>
        ))}
      </div>
    </section>
  );
}
