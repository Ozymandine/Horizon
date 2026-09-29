import { NextRequest, NextResponse } from "next/server";
import { getExploreRadar, type ExploreType } from "@/lib/radar";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const rawType = params.get("type");
  if (rawType !== "MOVIE" && rawType !== "SHOW" && rawType !== "GAME" && rawType !== "MUSIC") {
    return NextResponse.json({ error: "Choose a media category to explore." }, { status: 400 });
  }
  const genre = params.get("genre") ?? "";
  const genreId = /^\d+$/.test(genre) ? Number(genre) : Number.NaN;
  const year = Number(params.get("year"));
  const page = Number(params.get("page"));
  const sort = params.get("sort") === "rated" ? "rated" : "popular";
  const all = params.get("all") === "1";
  try {
    const options = {
      ...(genre && (Number.isSafeInteger(genreId) && genreId > 0 || /^tag:[\w& -]+$/.test(genre)) ? { genre } : {}),
      ...(Number.isSafeInteger(genreId) && genreId > 0 ? { genreId } : {}),
      ...(Number.isSafeInteger(year) && year >= 1900 && year <= new Date().getFullYear() + 10 ? { year } : {}),
      sort,
      page: Number.isSafeInteger(page) && page > 0 ? page : 1,
    } as const;
    if (!all) return NextResponse.json({ items: await getExploreRadar(rawType as ExploreType, options) });

    const pageCount = rawType === "MOVIE" || rawType === "SHOW" ? 6 : rawType === "MUSIC" ? 3 : year ? 1 : 5;
    const pages = await Promise.all(Array.from({ length: pageCount }, (_, index) => getExploreRadar(rawType as ExploreType, { ...options, page: index + 1 })));
    const unique = new Map<string, (typeof pages)[number][number]>();
    for (const item of pages.flat()) unique.set(`${item.source}:${item.sourceId}`, item);
    return NextResponse.json({ items: [...unique.values()] });
  } catch {
    return NextResponse.json({ error: "The catalog is unavailable right now." }, { status: 502 });
  }
}
