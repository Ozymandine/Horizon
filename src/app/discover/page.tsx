import { ExploreFeed } from "@/components/explore-feed";
import { getExploreRadar, getExploreShelves, type ExploreType, type RadarItem } from "@/lib/radar";

type SearchParams = Promise<{ type?: string; genre?: string; year?: string; sort?: string; all?: string; q?: string }>;

function category(value?: string): ExploreType {
  return value === "SHOW" || value === "GAME" || value === "MUSIC" ? value : "MOVIE";
}

function validGenre(value?: string) {
  if (!value) return "";
  return /^\d{1,5}$/.test(value) || /^tag:[\w& -]{1,24}$/.test(value) ? value : "";
}

export default async function DiscoverPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const type = category(params.type);
  const genre = validGenre(params.genre);
  const currentYear = new Date().getFullYear();
  const year = params.year && /^\d{4}$/.test(params.year) && Number(params.year) >= 1900 && Number(params.year) <= currentYear + 10 ? params.year : "";
  const sort = params.sort === "rated" ? "rated" : "popular";
  const all = params.all === "1";

  let items: RadarItem[] = [];
  let shelves = [] as Awaited<ReturnType<typeof getExploreShelves>>;
  if (all) {
    const pageCount = type === "MOVIE" || type === "SHOW" ? 6 : type === "MUSIC" ? 3 : year ? 1 : 5;
    const pages = await Promise.all(Array.from({ length: pageCount }, (_, index) => getExploreRadar(type, {
      ...(genre ? { genre } : {}),
      ...(year ? { year: Number(year) } : {}),
      sort,
      page: index + 1,
    }).catch(() => [])));
    const unique = new Map<string, RadarItem>();
    for (const item of pages.flat()) unique.set(`${item.source}:${item.sourceId}`, item);
    items = [...unique.values()];
  } else {
    [items, shelves] = await Promise.all([
      getExploreRadar(type, { ...(year ? { year: Number(year) } : {}), sort }).catch(() => []),
      getExploreShelves(type, { ...(year ? { year: Number(year) } : {}), sort }).catch(() => []),
    ]);
  }

  return (
    <main className="mx-auto min-h-screen max-w-[1440px] px-5 pb-32 pt-10 sm:px-8 sm:pt-14">
      <p className="mb-2 text-xs font-semibold uppercase tracking-[.2em] text-violet-200">Discover</p>
      <h1 className="mb-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">Explore {type === "MOVIE" ? "movies" : type === "SHOW" ? "series" : type === "GAME" ? "games" : "music"}</h1>
      <p className="mb-8 max-w-2xl text-sm leading-6 text-slate-300">Browse American film and television, popular games, and U.S. albums by genre and year.</p>
      <ExploreFeed initialType={type} initialGenre={genre} initialYear={year} initialSort={sort} initialAll={all} initialQuery={params.q?.slice(0, 120) ?? ""} initialItems={items} initialShelves={shelves} />
      <p className="mt-10 text-xs text-slate-400">Film and series art comes from TMDB; game listings from Steam; album dates and covers from MusicBrainz.</p>
    </main>
  );
}
