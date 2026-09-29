import { NextRequest, NextResponse } from "next/server";
import { getExploreRadar, type ExploreType } from "@/lib/radar";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const rawType = params.get("type");
  if (rawType !== "MOVIE" && rawType !== "SHOW" && rawType !== "GAME" && rawType !== "MUSIC") {
    return NextResponse.json({ error: "Choose a media category to explore." }, { status: 400 });
  }
  const genreId = Number(params.get("genre"));
  const year = Number(params.get("year"));
  const page = Number(params.get("page"));
  const sort = params.get("sort") === "rated" ? "rated" : "popular";
  try {
    const items = await getExploreRadar(rawType as ExploreType, {
      ...(Number.isSafeInteger(genreId) && genreId > 0 ? { genreId } : {}),
      ...(Number.isSafeInteger(year) && year >= 1900 && year <= new Date().getFullYear() ? { year } : {}),
      sort,
      page: Number.isSafeInteger(page) && page > 0 ? page : 1,
    });
    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ error: "The catalog is unavailable right now." }, { status: 502 });
  }
}
