import type { NextRequest } from "next/server";
import { privateStreamSession } from "@/lib/stream-relay";
import { getMovieDetails, getShowDetails } from "@/lib/tmdb";
import { playbackCatalog, playbackInteger } from "@/lib/playback-metadata";

export const runtime = "nodejs";
export const maxDuration = 15;
const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };

export async function GET(request: NextRequest) {
  if (!privateStreamSession(request)) return Response.json({ error: "Sign in to Horizon to play." }, { status: 401, headers });
  const params = request.nextUrl.searchParams;
  const id = playbackInteger(params.get("tmdbId"), 1, 2_147_483_647);
  const type = params.get("type");
  if (id === null || (type !== "movie" && type !== "show")) return Response.json({ error: "Choose a valid movie or series." }, { status: 400, headers });
  const details = type === "movie" ? await getMovieDetails(id) : await getShowDetails(id);
  if (!details) return Response.json({ error: "Title details are unavailable right now." }, { status: 502, headers });
  return Response.json(playbackCatalog(details), { headers });
}
