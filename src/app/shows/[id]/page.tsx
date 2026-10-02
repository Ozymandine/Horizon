import { notFound } from "next/navigation";
import { FilmDetail } from "@/components/film-detail";
import { getShowDetails } from "@/lib/tmdb";
import { getShowWatchOptions } from "@/lib/tmdb-watch";
import { safeReturnTo } from "@/lib/return-to";

export default async function ShowDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams?: Promise<{ returnTo?: string }> }) {
  const { id: rawId } = await params;
  const backTo = safeReturnTo((await searchParams)?.returnTo);
  const id = Number(rawId);
  if (!Number.isSafeInteger(id) || id <= 0) notFound();
  const [details, watchOptions] = await Promise.all([getShowDetails(id), getShowWatchOptions(id)]);
  if (!details) notFound();
  return <FilmDetail details={details} watchOptions={watchOptions} backTo={backTo}/>;
}
