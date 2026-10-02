import { notFound } from "next/navigation";
import { FilmDetail } from "@/components/film-detail";
import { getMovieDetails } from "@/lib/tmdb";
import { getMovieWatchOptions } from "@/lib/tmdb-watch";
import { safeReturnTo } from "@/lib/return-to";

export default async function MovieDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams?: Promise<{ returnTo?: string }> }) {
  const { id: rawId } = await params;
  const backTo = safeReturnTo((await searchParams)?.returnTo);
  const id = Number(rawId);
  if (!Number.isSafeInteger(id) || id <= 0) notFound();
  const [details, watchOptions] = await Promise.all([getMovieDetails(id), getMovieWatchOptions(id)]);
  if (!details) notFound();
  return <FilmDetail details={details} watchOptions={watchOptions} backTo={backTo}/>;
}
