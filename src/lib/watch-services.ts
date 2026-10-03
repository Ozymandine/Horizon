// The same service selection is used for discovery and title availability.
export const watchServices = [
  { name: "Netflix", ids: [8, 1796] },
  { name: "Amazon Prime Video", ids: [9] },
  { name: "Disney Plus", ids: [337] },
  { name: "Apple TV+", ids: [350] },
  { name: "Apple TV", ids: [2] },
  { name: "Hulu", ids: [15] },
  { name: "HBO Max", ids: [1899, 384] },
  { name: "Paramount Plus", ids: [2303, 2616, 531] },
  { name: "Peacock Premium", ids: [386, 387] },
  { name: "Crunchyroll", ids: [283] },
  { name: "Starz", ids: [43] },
  { name: "AMC+", ids: [526] },
  { name: "MGM Plus", ids: [34] },
  { name: "YouTube", ids: [192, 235] },
  { name: "Tubi TV", ids: [73] },
  { name: "Pluto TV", ids: [300] },
];

export function watchService(id: number) {
  return watchServices.find((service) => service.ids.includes(id));
}
