import { ExploreFeed } from "@/components/explore-feed";
import { getExploreRadar, type ExploreType } from "@/lib/radar";

type SearchParams = Promise<{ type?: string; genre?: string; year?: string; sort?: string; page?: string }>;

function category(value?: string): ExploreType {
  return value === "SHOW" || value === "GAME" || value === "MUSIC" ? value : "MOVIE";
}

export default async function DiscoverPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const type = category(params.type);
  const genre = params.genre && /^\d+$/.test(params.genre) ? params.genre : "";
  const year = params.year && /^\d{4}$/.test(params.year) ? params.year : "";
  const sort = params.sort === "rated" ? "rated" : "popular";
  const page = params.page && /^\d+$/.test(params.page) ? Math.max(1, Number(params.page)) : 1;
  const items = await getExploreRadar(type, {
    ...(genre ? { genreId: Number(genre) } : {}),
    ...(year ? { year: Number(year) } : {}),
    sort,
    page,
  }).catch(() => []);
  const intro = type === "MOVIE" ? "Explore American movies across genres and years."
    : type === "SHOW" ? "Explore American series across genres and years."
    : type === "GAME" ? "Explore popular PC games by release year."
    : "Browse American music releases by year, with soundtracks filtered out.";

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-5 pb-32 pt-10 sm:px-8 sm:pt-14">
      <p className="mb-3 text-xs font-semibold uppercase tracking-[.2em] text-violet-200">Discover</p>
      <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-5xl">Find something worth your time.</h1>
      <p className="mb-8 mt-3 max-w-2xl text-sm leading-6 text-slate-400">{intro} No AI recommendations or account connection required.</p>
      <ExploreFeed initialType={type} initialGenre={genre} initialYear={year} initialSort={sort} initialPage={page} initialItems={items} />
      <p className="mt-10 text-xs text-slate-500">Movie and series catalogs use TMDB. Game listings use Steam; music release data uses MusicBrainz.</p>
    </main>
  );
}
