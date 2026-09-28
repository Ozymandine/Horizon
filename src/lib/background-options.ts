export const backgroundOptions = [
  {
    id: "obsidian",
    label: "Obsidian",
    value: "radial-gradient(ellipse at 16% -12%, rgba(29,108,139,.20), transparent 38rem), radial-gradient(ellipse at 100% 35%, rgba(96,58,151,.14), transparent 34rem), #0b0e14",
  },
  {
    id: "plum",
    label: "Plum",
    value: "radial-gradient(ellipse at 12% 0%, rgba(175,66,157,.23), transparent 40rem), radial-gradient(ellipse at 100% 45%, rgba(79,68,177,.18), transparent 36rem), #100b15",
  },
  {
    id: "ember",
    label: "Ember",
    value: "radial-gradient(ellipse at 16% 0%, rgba(202,87,60,.20), transparent 40rem), radial-gradient(ellipse at 100% 50%, rgba(197,131,47,.13), transparent 36rem), #120d0d",
  },
  {
    id: "tide",
    label: "Tide",
    value: "radial-gradient(ellipse at 10% 0%, rgba(31,133,145,.22), transparent 42rem), radial-gradient(ellipse at 100% 48%, rgba(35,82,153,.18), transparent 38rem), #081116",
  },
] as const;

export type BackgroundId = (typeof backgroundOptions)[number]["id"];

export function applyBackground(id: string) {
  const selected = backgroundOptions.find((option) => option.id === id) ?? backgroundOptions[0];
  document.documentElement.style.setProperty("--horizon-background", selected.value);
  localStorage.setItem("horizon-background", selected.id);
}
