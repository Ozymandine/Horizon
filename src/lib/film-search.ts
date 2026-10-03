type FilmType = "MOVIE" | "SHOW";
export type FilmSearch = { label: string; genres: string[]; keyword?: string; year?: string };

const categories = [
  { pattern: /\banimes?\b/g, label: "Anime", movie: "16", show: "16", keyword: "210024" },
  { pattern: /\b(?:science fiction|sci[ -]?fi)\b/g, label: "Science fiction", movie: "878", show: "10765" },
  { pattern: /\b(?:animated|animation|cartoons?)\b/g, label: "Animation", movie: "16", show: "16" },
  { pattern: /\b(?:comedies|comedy)\b/g, label: "Comedy", movie: "35", show: "35" },
  { pattern: /\baction\b/g, label: "Action", movie: "28", show: "10759" },
  { pattern: /\badventure\b/g, label: "Adventure", movie: "12", show: "10759" },
  { pattern: /\bdramas?\b/g, label: "Drama", movie: "18", show: "18" },
  { pattern: /\bcrime\b/g, label: "Crime", movie: "80", show: "80" },
  { pattern: /\b(?:mysteries|mystery)\b/g, label: "Mystery", movie: "9648", show: "9648" },
  { pattern: /\bfantasy\b/g, label: "Fantasy", movie: "14", show: "10765" },
  { pattern: /\b(?:documentaries|documentary)\b/g, label: "Documentary", movie: "99", show: "99" },
  { pattern: /\bfamily\b/g, label: "Family", movie: "10751", show: "10751" },
  { pattern: /\bhorror\b/g, label: "Horror", movie: "27", show: "" },
  { pattern: /\b(?:romantic|romance)\b/g, label: "Romance", movie: "10749", show: "" },
  { pattern: /\bthrillers?\b/g, label: "Thriller", movie: "53", show: "" },
];

// Only complete category phrases become discovery queries; titles still use title search.
export function filmSearch(query: string, type: FilmType): FilmSearch | null {
  let remaining = query.toLowerCase().normalize("NFKC").replace(/\s+/g, " ").trim();
  if (!remaining) return null;
  const genres = new Set<string>();
  const labels: string[] = [];
  let keyword: string | undefined;
  for (const category of categories) {
    const genre = type === "MOVIE" ? category.movie : category.show;
    if (!genre) continue;
    const next = remaining.replace(category.pattern, " ");
    if (next !== remaining) { genres.add(genre); labels.push(category.label); keyword ??= category.keyword; remaining = next; }
  }
  const year = remaining.match(/\b(?:19|20)\d{2}\b/)?.[0];
  if (year) remaining = remaining.replace(year, " ");
  remaining = remaining.replace(/\b(?:movies?|films?|shows?|series|tv|titles?|and)\b/g, " ").replace(/[&,]/g, " ").trim();
  if (remaining || !genres.size) return null;
  return { label: labels.join(" · "), genres: [...genres], keyword, year };
}
