import { NextRequest, NextResponse } from "next/server";
import { discoveryState } from "@/lib/discovery-options";
import { getDiscoveryPage } from "@/lib/discovery";
import { getSteamGameDetails } from "@/lib/radar";
import { getMovieDetails, getShowDetails, tmdbImage } from "@/lib/tmdb";

export async function GET(request: NextRequest) {
  const state = discoveryState(request.nextUrl.searchParams);
  if (state.type === "MUSIC") return NextResponse.json({ items: [] });
  try {
    const catalog = await getDiscoveryPage({ ...state, q: "", genre: "", year: "", sort: "popular" });
    const featured = catalog.items.filter((item) => state.type !== "MOVIE" || item.sourceId !== "1599191").slice(0, 6);
    const items = await Promise.all(featured.map(async (item) => {
      if (item.source === "tmdb") {
        const details = state.type === "MOVIE" ? await getMovieDetails(Number(item.sourceId)) : await getShowDetails(Number(item.sourceId));
        const logo = details?.images?.logos?.find((entry) => entry.iso_639_1 === "en") ?? details?.images?.logos?.find((entry) => entry.iso_639_1 === null);
        return { ...item, logoUrl: tmdbImage(logo?.file_path ?? null, "w780"), posterFallbackUrls: details?.images?.backdrops?.slice(0, 3).map((entry) => tmdbImage(entry.file_path, "original")!).filter(Boolean), tags: details?.genres?.map((genre) => genre.name) };
      }
      if (item.source !== "steam") return item;
      const game = await getSteamGameDetails(item.sourceId);
      return game ? { ...item, posterUrl: game.headerImage ?? item.posterUrl, backdropUrl: game.screenshots[0] ?? game.background ?? game.headerImage ?? item.posterUrl, posterFallbackUrls: [...game.screenshots.slice(1), ...(item.posterFallbackUrls ?? [])], description: game.shortDescription.replace(/<[^>]+>/g, ""), tags: game.genres, displayDate: game.releaseDate } : item;
    }));
    return NextResponse.json({ items }, { headers: { "Cache-Control": "private, max-age=60" } });
  } catch { return NextResponse.json({ items: [] }); }
}
