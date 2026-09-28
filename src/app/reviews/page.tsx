import Link from "next/link";
import { MessageSquareText, Star } from "lucide-react";
import { ReviewForm } from "@/components/review-form";

const label = { MOVIE: "Movie", SHOW: "TV", GAME: "Game", MUSIC: "Music", EVENT: "Event" } as const;

export default async function ReviewsPage() {
  const entities = process.env.DATABASE_URL ? await (async () => {
    try {
      const { prisma } = await import("@/lib/prisma");
      return await prisma.entity.findMany({
        where: { isTracked: true },
        include: { review: true },
        orderBy: [{ updatedAt: "desc" }, { title: "asc" }],
      });
    } catch { return null; }
  })() : null;

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-5 pb-32 pt-10 sm:px-8 sm:pt-14">
      <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[.2em] text-amber-200"><Star size={14} /> Reviews</p>
      <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-5xl">Keep your own notes.</h1>
      <p className="mt-3 max-w-xl text-sm leading-6 text-slate-400">Give each release 1 to 5 stars and leave a comment for future you.</p>
      {entities === null ? (
        <div className="glass mt-9 rounded-3xl p-7 text-sm text-slate-400">Reviews are temporarily unavailable. Check the database connection.</div>
      ) : entities.length ? (
        <div className="mt-9 grid gap-4 lg:grid-cols-2">
          {entities.map((entity) => (
            <article key={entity.id} className="glass rounded-3xl p-5 sm:p-6">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[.16em] text-slate-500">{label[entity.type]} · {entity.displayDate}</p>
                  <h2 className="mt-1.5 text-lg font-semibold text-white"><Link href={`/entities/${entity.id}`} className="hover:text-cyan-100">{entity.title}</Link></h2>
                </div>
                {entity.review && <p className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-200/10 px-2.5 py-1.5 text-xs text-amber-100"><Star size={12} className="fill-amber-200" />{entity.review.rating}/5</p>}
              </div>
              <ReviewForm entityId={entity.id} initialRating={entity.review?.rating} initialComment={entity.review?.comment} />
            </article>
          ))}
        </div>
      ) : (
        <div className="glass mt-9 rounded-3xl p-8 sm:p-12">
          <MessageSquareText className="mb-4 text-amber-200" />
          <h2 className="text-lg font-semibold text-white">Nothing to review yet.</h2>
          <p className="mt-2 max-w-lg text-sm leading-6 text-slate-400">Add some releases to My List first. They will show up here ready for your rating and notes.</p>
          <Link href="/" className="mt-5 inline-flex rounded-full bg-white px-4 py-2.5 text-sm font-medium text-slate-950">Explore upcoming</Link>
        </div>
      )}
    </main>
  );
}
