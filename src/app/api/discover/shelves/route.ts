import { NextRequest, NextResponse } from "next/server";
import { getExploreShelves, type ExploreType } from "@/lib/radar";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const rawType = params.get("type");
  if (rawType !== "MOVIE" && rawType !== "SHOW" && rawType !== "GAME" && rawType !== "MUSIC") {
    return NextResponse.json({ error: "Choose a media category to explore." }, { status: 400 });
  }

  const rawYear = Number(params.get("year"));
  const year = Number.isSafeInteger(rawYear) && rawYear >= 1900 && rawYear <= new Date().getFullYear() + 10 ? rawYear : undefined;
  const sort = params.get("sort") === "rated" ? "rated" : "popular";

  try {
    const shelves = await getExploreShelves(rawType as ExploreType, { year, sort });
    return NextResponse.json({ shelves });
  } catch {
    return NextResponse.json({ error: "The catalog is unavailable right now." }, { status: 502 });
  }
}
