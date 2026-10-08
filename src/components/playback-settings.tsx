"use client";

import { useState, useSyncExternalStore } from "react";
import { PLAYBACK_SETTINGS_KEY, playbackPreferences, type PlaybackPreferences } from "@/lib/playback-preferences";

function subscribeStorage(callback: () => void) { window.addEventListener("storage", callback); return () => window.removeEventListener("storage", callback); }
function storedSettings() { try { return localStorage.getItem(PLAYBACK_SETTINGS_KEY) || "{}"; } catch { return "{}"; } }
function subscribeScreen(callback: () => void) { window.addEventListener("resize", callback); return () => window.removeEventListener("resize", callback); }
function screenSnapshot() { return `${window.innerWidth} × ${window.innerHeight} viewport · ${Math.round(screen.width * devicePixelRatio)} × ${Math.round(screen.height * devicePixelRatio)} screen`; }
const emptySettings = () => "{}", emptyScreen = () => "";

export function PlaybackSettings() {
  const [edited, setEdited] = useState<PlaybackPreferences | null>(null);
  const raw = useSyncExternalStore(subscribeStorage, storedSettings, emptySettings);
  const screenSize = useSyncExternalStore(subscribeScreen, screenSnapshot, emptyScreen);
  let stored = playbackPreferences({});
  try { stored = playbackPreferences(JSON.parse(raw)); } catch { /* Use defaults for damaged browser storage. */ }
  const settings = edited ?? stored;
  function update(values: Partial<PlaybackPreferences>) {
    const next = playbackPreferences({ ...settings, ...values });
    setEdited(next);
    try { localStorage.setItem(PLAYBACK_SETTINGS_KEY, JSON.stringify(next)); } catch { /* Playback can still use the selected values. */ }
  }
  return <section aria-labelledby="playback-settings-heading">
    <h2 id="playback-settings-heading" className="text-lg font-semibold text-white">Playback</h2>
    <p className="mt-2 text-sm text-white/60">The player fills the page. Choose how the picture fits your screen.</p>
    <div className="mt-5 grid gap-5 sm:grid-cols-2">
      <label className="text-sm text-white/80">Picture fit<select className="mt-2 block w-full rounded-xl border border-white/15 bg-[#172126] px-3 py-3 text-white" value={settings.fit} onChange={(event) => update({ fit: event.target.value as PlaybackPreferences["fit"] })}><option value="fit">Fit — show the whole picture</option><option value="fill">Fill — crop to fit the screen</option><option value="auto">Auto crop — detect black bars</option></select></label>
      <label className="text-sm text-white/80">Playback speed<select className="mt-2 block w-full rounded-xl border border-white/15 bg-[#172126] px-3 py-3 text-white" value={settings.speed} onChange={(event) => update({ speed: Number(event.target.value) })}>{[.5, .75, 1, 1.25, 1.5, 2].map((value) => <option key={value} value={value}>{value}×</option>)}</select></label>
      <label className="text-sm text-white/80">Extra zoom · {settings.zoom.toFixed(2)}×<input className="mt-4 block w-full accent-white" type="range" min="1" max="2.5" step=".05" value={settings.zoom} onChange={(event) => update({ zoom: Number(event.target.value) })}/></label>
      <label className="text-sm text-white/80">Subtitle size · {settings.subtitleSize}%<input className="mt-4 block w-full accent-white" type="range" min="75" max="175" step="5" value={settings.subtitleSize} onChange={(event) => update({ subtitleSize: Number(event.target.value) })}/></label>
    </div>
    <p className="mt-5 text-xs leading-6 text-white/50">{screenSize}<br/>Fill and zoom crop the edges. Auto crop waits for consistent dark borders; manual zoom is available in the player.</p>
  </section>;
}
