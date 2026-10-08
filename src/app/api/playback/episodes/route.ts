import type { NextRequest } from "next/server";
import { privateStreamSession } from "@/lib/stream-relay";
import { getShowSeason } from "@/lib/tmdb";
import { playbackEpisodes, playbackInteger } from "@/lib/playback-metadata";

export const runtime = "nodejs";
export const maxDuration = 15;
const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };

export async function GET(request: NextRequest) {
  if (!privateStreamSession(request)) return Response.json({ error: "Sign in to Horizon to play." }, { status: 401, headers });
  const params = request.nextUrl.searchParams;
  const id = playbackInteger(params.get("tmdbId"), 1, 2_147_483_647);
  const season = playbackInteger(params.get("season"), 0, 1000);
  if (id === null || season === null) return Response.json({ error: "Choose a valid series and season." }, { status: 400, headers });
  try {
    const details = await getShowSeason(id, season);
    if (details.season_number !== season) throw new Error("The catalog returned another season.");
    return Response.json(playbackEpisodes(details), { headers });
  } catch {
    return Response.json({ error: "Episodes are unavailable right now. Try again." }, { status: 502, headers });
  }
}
