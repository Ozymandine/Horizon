import type { RadarType } from "@/lib/radar";

export type DiscoverShelf = { value: string; label: string };

export const discoverShelves: Record<RadarType, DiscoverShelf[]> = {
  MOVIE: [
    { value: "28", label: "Action" },
    { value: "35", label: "Comedy" },
    { value: "18", label: "Drama" },
    { value: "878", label: "Science fiction" },
    { value: "27", label: "Horror" },
  ],
  SHOW: [
    { value: "10759", label: "Action & adventure" },
    { value: "35", label: "Comedy" },
    { value: "18", label: "Drama" },
    { value: "80", label: "Crime" },
    { value: "10765", label: "Science fiction & fantasy" },
  ],
  GAME: [
    { value: "tag:19", label: "Action" },
    { value: "tag:21", label: "Adventure" },
    { value: "tag:122", label: "Role-playing" },
    { value: "tag:9", label: "Strategy" },
    { value: "tag:599", label: "Simulation" },
  ],
  MUSIC: [
    { value: "tag:pop", label: "Pop" },
    { value: "tag:rock", label: "Rock" },
    { value: "tag:hip hop", label: "Hip-hop" },
    { value: "tag:r&b", label: "R&B" },
    { value: "tag:country", label: "Country" },
  ],
};
