import { NextRequest, NextResponse } from "next/server";
import { discoveryState } from "@/lib/discovery-options";
import { getDiscoveryPage } from "@/lib/discovery";
import { getSteamGameDetails } from "@/lib/radar";

export async function GET(request: NextRequest) {
  const state = discoveryState(request.nextUrl.searchParams);
  if (state.type !== "GAME") return NextResponse.json({ items: [] });
  try {
    const catalog = await getDiscoveryPage({ ...state, q: "", genre: "", year: "", sort: "popular" });
    const items = await Promise.all(catalog.items.slice(0, 6).map(async (item) => {
      if (item.source !== "steam") return item;
      const game = await getSteamGameDetails(item.sourceId);
      return game ? { ...item, backdropUrl: game.screenshots[0] ?? game.background ?? item.posterUrl, description: game.shortDescription.replace(/<[^>]+>/g, ""), tags: game.genres, displayDate: game.releaseDate } : item;
    }));
    return NextResponse.json({ items }, { headers: { "Cache-Control": "private, max-age=60" } });
  } catch { return NextResponse.json({ items: [] }); }
}
