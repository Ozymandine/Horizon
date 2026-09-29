"use client";

import { useEffect, useState } from "react";
import { applyBackground, backgroundOptions } from "@/lib/background-options";

export function BackgroundSettings() {
  const [active, setActive] = useState<string>(backgroundOptions[0].id);

  useEffect(() => {
    const saved = localStorage.getItem("horizon-background") ?? backgroundOptions[0].id;
    setActive(saved);
    applyBackground(saved);
  }, []);

  return (
    <section>
      <div className="mb-5 flex items-end justify-between gap-4">
        <div><h2 className="text-lg font-medium text-white">Page gradient</h2><p className="mt-1 text-sm text-slate-400">Choose a blended two-color gradient for the full page.</p></div>
        <span className="text-xs text-slate-400">{backgroundOptions.find((option) => option.id === active)?.label}</span>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {backgroundOptions.map((option) => (
          <button key={option.id} type="button" aria-pressed={active === option.id} onClick={() => { setActive(option.id); applyBackground(option.id); }} className={`group overflow-hidden rounded-2xl border text-left transition ${active === option.id ? "border-white/55 shadow-lg shadow-black/20" : "border-white/10 hover:border-white/30"}`}>
            <span aria-hidden className="block h-16 sm:h-20" style={{ background: option.value }} />
            <span className={`block px-3 py-2.5 text-xs ${active === option.id ? "text-white" : "text-slate-300"}`}>{option.label}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
