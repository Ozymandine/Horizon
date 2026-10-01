import type { RadarType } from "@/lib/radar";
import { discoverShelves } from "@/lib/discover-shelves";

export const mediaCategories: { value: RadarType; label: string }[] = [
  { value: "MOVIE", label: "Movies" }, { value: "SHOW", label: "Shows" },
  { value: "GAME", label: "Games" }, { value: "MUSIC", label: "Music" },
];
export type DiscoveryState = { type: RadarType; genre: string; year: string; sort: string; provider: string; country: string; q: string; all: boolean };
export const defaultDiscovery: DiscoveryState = { type: "MOVIE", genre: "", year: "", sort: "popular", provider: "", country: "US", q: "", all: false };
export const countries = [{ value: "US", label: "United States" }, { value: "GB", label: "United Kingdom" }, { value: "CA", label: "Canada" }, { value: "AU", label: "Australia" }, { value: "DE", label: "Germany" }, { value: "FR", label: "France" }, { value: "JP", label: "Japan" }, { value: "KR", label: "South Korea" }, { value: "IN", label: "India" }];
export function discoveryState(params: URLSearchParams): DiscoveryState {
  const type = mediaCategories.find((entry) => entry.value === params.get("type"))?.value ?? "MOVIE";
  const sorts = type === "MUSIC" ? ["popular", "songs", "artists", "new", "upcoming"] : type === "GAME" ? ["popular", "rated", "upcoming"] : ["popular", "rated", "now", "upcoming"];
  const rawYear = params.get("year") ?? "";
  const query = (params.get("q") ?? "").trim().slice(0, 80);
  return { ...defaultDiscovery, type,
    genre: discoverShelves[type].some((entry) => entry.value === params.get("genre")) ? params.get("genre")! : "",
    year: /^\d{4}$/.test(rawYear) && Number(rawYear) >= 1900 && Number(rawYear) <= new Date().getFullYear() + 10 ? rawYear : "",
    sort: sorts.includes(params.get("sort") ?? "") ? params.get("sort")! : "popular",
    provider: /^\d{1,6}$/.test(params.get("provider") ?? "") ? params.get("provider")! : "",
    country: countries.some((entry) => entry.value === params.get("country")) ? params.get("country")! : "US",
    q: query, all: params.get("all") === "1" || Boolean(query),
  };
}
export function discoveryQuery(state: DiscoveryState) {
  const params = new URLSearchParams({ type: state.type });
  for (const key of ["genre", "year", "provider", "q"] as const) if (state[key]) params.set(key, state[key]);
  if (state.sort !== "popular") params.set("sort", state.sort);
  if (state.country !== "US") params.set("country", state.country);
  if (state.all) params.set("all", "1");
  return params.toString();
}
export function discoveryRows(type: RadarType) {
  const categories = discoverShelves[type].map((shelf) => ({ ...shelf, sort: "popular", genre: shelf.value }));
  if (type === "MUSIC") return [
    { value: "songs", label: "Songs on repeat", sort: "songs", genre: "" },
    { value: "popular", label: "Albums in the spotlight", sort: "popular", genre: "" },
    { value: "artists", label: "Explore artists", sort: "artists", genre: "" },
    { value: "upcoming", label: "Upcoming releases", sort: "upcoming", genre: "" }, ...categories,
  ];
  return [
    { value: "upcoming", label: "Coming soon", sort: "upcoming", genre: "" },
    { value: "popular", label: type === "GAME" ? "Popular games" : `Popular ${type === "MOVIE" ? "movies" : "shows"}`, sort: "popular", genre: "" },
    { value: "rated", label: "Highly rated", sort: "rated", genre: "" },
    ...(type !== "GAME" ? [{ value: "now", label: type === "MOVIE" ? "In theaters" : "On the air", sort: "now", genre: "" }] : []), ...categories,
  ];
}
