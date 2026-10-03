type FilmType = "MOVIE" | "SHOW";
export type FilmSearch = { label: string; genres: string[]; keyword?: string; companies?: string[]; year?: string };

const franchises = [
  { pattern: /\b(?:marvel cinematic universe|mcu)\b/g, label: "Marvel Cinematic Universe", keyword: "180547" },
  { pattern: /\b(?:marvel comics|marvel)\b/g, label: "Marvel", companies: ["420", "19551", "7505", "38679", "13252", "2301", "108634", "11106", "213000"] },
  { pattern: /\b(?:dc comics|dc universe|dceu|dcu|dc)\b/g, label: "DC", companies: ["429", "9993", "128064", "165407", "143211"] },
  { pattern: /\b(?:walt disney|disney)\b/g, label: "Disney", companies: ["2", "6125"] },
  { pattern: /\bpixar\b/g, label: "Pixar", companies: ["3"] },
  { pattern: /\b(?:studio ghibli|ghibli)\b/g, label: "Studio Ghibli", companies: ["10342"] },
  { pattern: /\bdreamworks\b/g, label: "DreamWorks", companies: ["7", "521"] },
];

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
  { pattern: /\bsuperheroes?\b/g, label: "Superheroes", movie: "", show: "", keyword: "9715" },
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
  let companies: string[] | undefined;
  for (const franchise of franchises) {
    const next = remaining.replace(franchise.pattern, " ");
    if (next !== remaining) { labels.push(franchise.label); keyword ??= franchise.keyword; companies ??= franchise.companies; remaining = next; }
  }
  for (const category of categories) {
    const genre = type === "MOVIE" ? category.movie : category.show;
    if (!genre && !category.keyword) continue;
    const next = remaining.replace(category.pattern, " ");
    if (next !== remaining) { if (genre) genres.add(genre); labels.push(category.label); keyword ??= category.keyword; remaining = next; }
  }
  const year = remaining.match(/\b(?:19|20)\d{2}\b/)?.[0];
  if (year) remaining = remaining.replace(year, " ");
  remaining = remaining.replace(/\b(?:movies?|films?|shows?|series|tv|titles?|and)\b/g, " ").replace(/[&,]/g, " ").trim();
  if (remaining || !labels.length) return null;
  return { label: labels.join(" · "), genres: [...genres], keyword, companies, year };
}
