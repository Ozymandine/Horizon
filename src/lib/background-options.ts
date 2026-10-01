export const backgroundOptions = [
  { id: "blue-green", label: "Blue + Green", value: "linear-gradient(135deg, #0b2540 0%, #123d35 100%)" },
  { id: "ocean-teal", label: "Ocean + Teal", value: "linear-gradient(135deg, #082b49 0%, #06413f 100%)" },
  { id: "indigo-violet", label: "Indigo + Violet", value: "linear-gradient(135deg, #171d4b 0%, #38224e 100%)" },
  { id: "plum-rose", label: "Plum + Rose", value: "linear-gradient(135deg, #321b3d 0%, #4b263d 100%)" },
  { id: "wine-copper", label: "Wine + Copper", value: "linear-gradient(135deg, #3b1828 0%, #54301f 100%)" },
  { id: "rust-gold", label: "Rust + Gold", value: "linear-gradient(135deg, #482018 0%, #4e391b 100%)" },
  { id: "forest-olive", label: "Forest + Olive", value: "linear-gradient(135deg, #103329 0%, #353d1c 100%)" },
  { id: "jade-navy", label: "Jade + Navy", value: "linear-gradient(135deg, #103d36 0%, #142846 100%)" },
  { id: "slate-ice", label: "Slate + Ice", value: "linear-gradient(135deg, #202a39 0%, #153749 100%)" },
  { id: "cobalt-aqua", label: "Cobalt + Aqua", value: "linear-gradient(135deg, #172b5a 0%, #12504f 100%)" },
  { id: "midnight-plum", label: "Midnight + Plum", value: "linear-gradient(135deg, #111927 0%, #37203f 100%)" },
  { id: "charcoal-crimson", label: "Charcoal + Crimson", value: "linear-gradient(135deg, #24252b 0%, #4a202a 100%)" },
  { id: "deep-teal-amber", label: "Deep Teal + Amber", value: "linear-gradient(135deg, #0c3438 0%, #4b3219 100%)" },
  { id: "blue-lavender", label: "Blue + Lavender", value: "linear-gradient(135deg, #1d3156 0%, #3e2a55 100%)" },
  { id: "evergreen-blue", label: "Evergreen + Blue", value: "linear-gradient(135deg, #183a2e 0%, #173957 100%)" },
  { id: "black-berry", label: "Blackberry + Berry", value: "linear-gradient(135deg, #201a32 0%, #4a243e 100%)" },
] as const;

export const defaultGradient = { first: "#0b2540", second: "#123d35" };

function notifyBackgroundPreference() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("horizon:background-changed"));
}

export function getBackgroundPreferenceSnapshot() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("horizon-background") ?? "";
}

export function subscribeBackgroundPreference(onChange: () => void) {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener("horizon:background-changed", onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener("horizon:background-changed", onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function gradientColors(preference: string) {
  if (preference) {
    try {
      const value = JSON.parse(preference) as { first?: string; second?: string };
      if (value.first && value.second) return { first: value.first, second: value.second };
    } catch { /* Named presets are resolved below. */ }
    const preset = backgroundOptions.find((option) => option.id === preference);
    if (preset) {
      const found = preset.value.match(/#[\da-f]{6}/gi) ?? [];
      return { first: found[0] ?? defaultGradient.first, second: found[1] ?? defaultGradient.second };
    }
  }
  return defaultGradient;
}

export function applyBackground(id: string) {
  const selected = backgroundOptions.find((option) => option.id === id) ?? backgroundOptions[0];
  document.documentElement.style.setProperty("--horizon-background", selected.value);
  localStorage.setItem("horizon-background", selected.id);
  notifyBackgroundPreference();
}

export function applyGradient(first: string, second: string) {
  const isHex = (value: string) => /^#[\da-f]{6}$/i.test(value);
  const colors = { first: isHex(first) ? first : defaultGradient.first, second: isHex(second) ? second : defaultGradient.second };
  document.documentElement.style.setProperty("--horizon-background", `linear-gradient(135deg, ${colors.first} 0%, ${colors.second} 100%)`);
  localStorage.setItem("horizon-background", JSON.stringify(colors));
  notifyBackgroundPreference();
}

export function applyStoredBackground(preference: string | null) {
  if (!preference) {
    applyBackground(backgroundOptions[0].id);
    return;
  }
  try {
    const colors = JSON.parse(preference) as { first?: string; second?: string };
    if (/^#[\da-f]{6}$/i.test(colors.first ?? "") && /^#[\da-f]{6}$/i.test(colors.second ?? "")) {
      document.documentElement.style.setProperty("--horizon-background", `linear-gradient(135deg, ${colors.first} 0%, ${colors.second} 100%)`);
      return;
    }
  } catch { /* Named presets are handled by applyBackground. */ }
  applyBackground(preference);
}
