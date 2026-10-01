"use client";

import { applyBackground, applyGradient, backgroundOptions, gradientColors } from "@/lib/background-options";
import { useBackgroundPreference } from "@/lib/use-browser-preferences";

export function BackgroundSettings() {
  const preference = useBackgroundPreference();
  const colors = gradientColors(preference);

  function updateColor(key: "first" | "second", value: string) {
    const next = { ...colors, [key]: value };
    applyGradient(next.first, next.second);
  }

  return (
    <section>
      <div className="mb-5">
        <h2 className="text-lg font-medium text-white">Page theme</h2><p className="mt-1 text-sm text-white/75">Choose a calm preset or customize the two background colors. Text surfaces stay dark enough to remain readable.</p>
      </div>
      <div className="mb-5 flex flex-wrap gap-2">
        {backgroundOptions.map((option) => <button key={option.id} type="button" onClick={() => applyBackground(option.id)} aria-label={`Use ${option.label} theme`} className="size-9 rounded-full border border-white/35 shadow-inner shadow-white/10 transition hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white" style={{ background: option.value }} />)}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {(["first", "second"] as const).map((key, index) => <label key={key} className="glass flex items-center gap-4 rounded-2xl p-4">
          <input type="color" value={colors[key]} onChange={(event) => updateColor(key, event.target.value)} aria-label={`Gradient color ${index + 1}`} className="size-14 cursor-pointer rounded-xl border-0 bg-transparent p-0" />
          <span><span className="block text-sm font-medium text-white">Color {index + 1}</span><span className="mt-1 block font-mono text-xs uppercase text-white/75">{colors[key]}</span></span>
        </label>)}
      </div>
      <div className="mt-5 h-24 rounded-2xl border border-white/15" style={{ background: `linear-gradient(180deg, rgba(3,10,17,.28), rgba(3,10,17,.58)), linear-gradient(135deg, ${colors.first}, ${colors.second})` }} aria-label="Gradient preview" />
    </section>
  );
}
