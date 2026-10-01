import Link from "next/link";
import { RemoveFromListButton } from "@/components/remove-from-list-button";
import { ReviewForm } from "@/components/review-form";
import { MediaArtwork } from "@/components/media-artwork";
import { getUpcomingRadar, type RadarItem } from "@/lib/radar";

export const revalidate = 3600;

const category = {
  MOVIE: ["Movie", "text-cyan-200"], SHOW: ["TV", "text-cyan-200"],
  GAME: ["Game", "text-violet-200"], MUSIC: ["Music", "text-amber-200"], EVENT: ["Event", "text-fuchsia-200"],
} as const;

export default async function MyListPage() {
  const storedData = process.env.DATABASE_URL ? await (async () => {
    try {
      const { prisma } = await import("@/lib/prisma");
      const [entities, lists] = await Promise.all([
        prisma.entity.findMany({ where: { isTracked: true }, include: { review: true }, orderBy: [{ sortTimestamp: "asc" }, { title: "asc" }] }),
        prisma.releaseList.findMany({ orderBy: { name: "asc" }, include: { items: { include: { entity: true }, orderBy: { createdAt: "desc" } } } }),
      ]);
      return { entities, lists };
    } catch { return null; }
  })() : null;
  const storedEntities = storedData?.entities ?? null;
  const lists = storedData?.lists ?? [];
  const currentFeed = storedEntities?.length ? await getUpcomingRadar() : null;
  const catalog = new Map<string, RadarItem>(currentFeed ? Object.values(currentFeed).flat().filter((release) => release.tmdbId)
    .map((release): [string, RadarItem] => [`${release.type}:${release.tmdbId}`, release]) : []);
  const entities = storedEntities?.map((entity) => {
    const release = catalog.get(`${entity.type}:${entity.tmdbId}`);
    return release ? { ...entity, title: release.title, displayDate: release.displayDate, posterUrl: release.posterUrl, sortTimestamp: release.sortTimestamp ? new Date(release.sortTimestamp) : null } : entity;
  }).sort((a, b) => (a.sortTimestamp?.getTime() ?? Number.MAX_SAFE_INTEGER) - (b.sortTimestamp?.getTime() ?? Number.MAX_SAFE_INTEGER) || a.title.localeCompare(b.title)) ?? null;

  return (
    <main className="mx-auto min-h-screen max-w-[1440px] px-5 pb-32 pt-10 sm:px-8 sm:pt-14">
      <p className="mb-3 text-xs font-semibold uppercase tracking-[.2em] text-amber-200">My List</p>
      <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-5xl">Things on your radar.</h1>
      <p className="mt-3 max-w-xl text-sm leading-6 text-slate-400">The releases you chose to follow, with dates, ratings, and your notes.</p>
      {lists.length > 0 && <section className="mt-10 space-y-8">
        {lists.map((list) => <div key={list.id}>
          <h2 className="mb-4 text-xl font-semibold text-white">{list.name}</h2>
          {list.items.length ? <div className="grid grid-cols-2 justify-items-center gap-4 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4 xl:grid-cols-5">
            {list.items.map(({ entity }) => {
              const href = entity.tmdbId ? (entity.type === "SHOW" ? `/shows/${entity.tmdbId}` : `/movies/${entity.tmdbId}`)
                : entity.source === "steam" && entity.sourceId ? `/releases/steam/${entity.sourceId}`
                : entity.source === "musicbrainz" && entity.sourceId ? `/releases/musicbrainz/${entity.sourceId}`
                : entity.source === "musicbrainz-recording" && entity.sourceId ? `/releases/musicbrainz-recording/${entity.sourceId}`
                : `/entities/${entity.id}`;
              return <Link key={entity.id} href={href} aria-label={`Open ${entity.title}`} title={entity.title} className={`group relative w-full max-w-[205px] ${entity.type === "MUSIC" ? "aspect-square" : "aspect-[2/3]"} overflow-hidden rounded-[1.25rem] border border-white/10 bg-slate-950 shadow-lg shadow-black/25`}>
                <MediaArtwork title={entity.title} type={entity.type} imageUrl={entity.posterUrl} />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/15 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-3"><p className="line-clamp-2 text-sm font-semibold text-white">{entity.title}</p><p className="mt-1 text-[11px] text-white/75">{entity.displayDate}</p></div>
              </Link>;
            })}
          </div> : <p className="glass rounded-2xl p-5 text-sm text-slate-400">This list is empty.</p>}
        </div>)}
      </section>}
      {entities === null ? (
        <div className="glass mt-9 rounded-3xl p-7 text-sm text-slate-400">My List could not load just now. Refresh to try again.</div>
      ) : entities.length ? (
        <div className="mt-9 grid grid-cols-2 justify-items-center gap-x-4 gap-y-5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {entities.map((entity) => {
            const [label, color] = category[entity.type];
            const href = entity.tmdbId ? (entity.type === "SHOW" ? `/shows/${entity.tmdbId}` : `/movies/${entity.tmdbId}`)
              : entity.source === "steam" && entity.sourceId ? `/releases/steam/${entity.sourceId}`
              : entity.source === "musicbrainz" && entity.sourceId ? `/releases/musicbrainz/${entity.sourceId}`
              : entity.source === "musicbrainz-recording" && entity.sourceId ? `/releases/musicbrainz-recording/${entity.sourceId}`
              : `/entities/${entity.id}`;
            return (
              <article key={entity.id} className="glass relative w-full max-w-[205px] overflow-hidden rounded-2xl p-2.5">
                <Link href={href} aria-label={`Open ${entity.title}`} title={entity.title} className={`group relative block ${entity.type === "MUSIC" ? "aspect-square" : "aspect-[2/3]"} overflow-hidden rounded-xl border border-white/10 bg-slate-950`}>
                  <MediaArtwork title={entity.title} type={entity.type} imageUrl={entity.posterUrl} fallbackUrls={entity.type === "GAME" && entity.sourceId ? [`https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${entity.sourceId}/library_600x900_2x.jpg`, `https://cdn.cloudflare.steamstatic.com/steam/apps/${entity.sourceId}/library_600x900.jpg`] : []} />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-2.5"><p className={`text-[9px] font-semibold uppercase tracking-[.15em] ${color}`}>{label}</p><h2 className="mt-1 line-clamp-2 text-xs font-semibold leading-4 text-white">{entity.title}</h2><p className="mt-1 line-clamp-1 text-[10px] text-white/75">{entity.displayDate}</p>{entity.review && <p className="mt-1 text-[10px] text-amber-200">★ {entity.review.rating}/5</p>}</div>
                </Link>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <details className="min-w-0">
                    <summary className="cursor-pointer list-none truncate text-[10px] text-white/75 transition hover:text-white">{entity.review ? "Edit review" : "Rate & review"}</summary>
                    <div className="absolute left-0 z-20 mt-2 w-[min(92vw,340px)] rounded-2xl border border-white/15 bg-slate-950/95 p-4 shadow-2xl backdrop-blur-xl"><ReviewForm entityId={entity.id} initialRating={entity.review?.rating} initialComment={entity.review?.comment} /></div>
                  </details>
                  <RemoveFromListButton entityId={entity.id} />
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="glass mt-9 rounded-3xl p-8 sm:p-12">
          <p className="text-lg font-semibold text-white">Your list is ready for its first pick.</p>
          <p className="mt-2 max-w-lg text-sm leading-6 text-slate-400">Browse upcoming releases, open a title, and choose “Add to timeline.” Saved items will appear here and on your timeline.</p>
          <Link href="/" className="mt-5 inline-flex rounded-full bg-white px-4 py-2.5 text-sm font-medium text-slate-950">Browse upcoming</Link>
        </div>
      )}
    </main>
  );
}
