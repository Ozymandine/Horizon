import Link from "next/link";
import { RemoveFromListButton } from "@/components/remove-from-list-button";
import { ReviewForm } from "@/components/review-form";
import { MediaArtwork } from "@/components/media-artwork";

const category = {
  MOVIE: ["Movie", "text-cyan-200"], SHOW: ["TV", "text-cyan-200"],
  GAME: ["Game", "text-violet-200"], MUSIC: ["Music", "text-amber-200"], EVENT: ["Event", "text-fuchsia-200"],
} as const;

export default async function MyListPage() {
  const entities = process.env.DATABASE_URL ? await (async () => {
    try {
      const { prisma } = await import("@/lib/prisma");
      return await prisma.entity.findMany({
        where: { isTracked: true },
        include: { review: true },
        orderBy: [{ sortTimestamp: "asc" }, { title: "asc" }],
      });
    } catch { return null; }
  })() : null;

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-5 pb-32 pt-10 sm:px-8 sm:pt-14">
      <p className="mb-3 text-xs font-semibold uppercase tracking-[.2em] text-amber-200">My List</p>
      <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-5xl">Things on your radar.</h1>
      <p className="mt-3 max-w-xl text-sm leading-6 text-slate-400">The releases you chose to follow, with dates, ratings, and your notes.</p>
      {entities === null ? (
        <div className="glass mt-9 rounded-3xl p-7 text-sm text-slate-400">My List could not load just now. Refresh to try again.</div>
      ) : entities.length ? (
        <div className="mt-9 space-y-3">
          {entities.map((entity) => {
            const [label, color] = category[entity.type];
            const href = entity.tmdbId ? (entity.type === "SHOW" ? `/shows/${entity.tmdbId}` : `/movies/${entity.tmdbId}`) : `/entities/${entity.id}`;
            return (
              <article key={entity.id} className="glass rounded-3xl p-4 sm:p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <Link href={href} aria-label={`Open ${entity.title}`} className="flex min-w-0 flex-1 items-center gap-4">
                  <div className="size-20 shrink-0 overflow-hidden rounded-2xl border border-white/10">
                    <MediaArtwork title={entity.title} type={entity.type} imageUrl={entity.posterUrl} fallbackUrls={entity.type === "GAME" && entity.sourceId ? [`https://cdn.cloudflare.steamstatic.com/steam/apps/${entity.sourceId}/library_600x900.jpg`] : []} />
                  </div>
                  <div className="min-w-0">
                    <p className={`text-[10px] font-semibold uppercase tracking-[.15em] ${color}`}>{label}</p>
                    <h2 className="mt-1 truncate font-semibold text-white">{entity.title}</h2>
                    <p className="mt-1 text-xs text-slate-400">{entity.displayDate}</p>
                    {entity.review && <p className="mt-1.5 text-xs text-amber-200">★ {entity.review.rating}/5</p>}
                  </div>
                </Link>
                <div className="flex items-center justify-between gap-3 sm:justify-end">
                  <RemoveFromListButton entityId={entity.id} />
                </div>
                </div>
                <details className="mt-4 border-t border-white/[.08] pt-3">
                  <summary className="w-fit cursor-pointer list-none rounded-full border border-white/10 px-3 py-2 text-xs text-slate-300 transition hover:bg-white/5 hover:text-white">{entity.review ? "Edit rating or review" : "Rate and review"}</summary>
                  <div className="mt-4 max-w-xl"><ReviewForm entityId={entity.id} initialRating={entity.review?.rating} initialComment={entity.review?.comment} /></div>
                </details>
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
