import type { NextRequest } from "next/server";
import { privateStreamSession, relayResponse } from "@/lib/stream-relay";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  if (!privateStreamSession(request)) return Response.json({ error: "Sign in to Horizon to play." }, { status: 401 });
  // Next can normalize 127.0.0.1 to localhost internally; compare the actual HTTP host.
  const origin = request.headers.get("origin");
  let sameOrigin = false;
  try { sameOrigin = Boolean(origin && new URL(origin).host === request.headers.get("host") && new URL(origin).protocol === request.nextUrl.protocol); } catch { /* Invalid origin. */ }
  if (!sameOrigin) return Response.json({ error: "Use Play from your Horizon details page." }, { status: 403 });
  if (!request.headers.get("content-type")?.startsWith("application/json")) return Response.json({ error: "A JSON playback request is required." }, { status: 415 });
  if (Number(request.headers.get("content-length") || 0) > 4096) return Response.json({ error: "Playback request is too large." }, { status: 413 });
  // Bound chunked bodies too, before allocating or parsing an untrusted JSON document.
  const reader = request.body?.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  if (reader) {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > 4096) {
          await reader.cancel();
          return Response.json({ error: "Playback request is too large." }, { status: 413 });
        }
        chunks.push(value);
      }
    } catch { return Response.json({ error: "Invalid playback request." }, { status: 400 }); }
    finally { reader.releaseLock(); }
  }
  const body = Buffer.concat(chunks).toString("utf8");
  let payload: { type?: unknown; tmdbId?: unknown; season?: unknown; episode?: unknown };
  try { payload = JSON.parse(body); } catch { return Response.json({ error: "Invalid playback request." }, { status: 400 }); }
  if (!payload || !["movie", "show"].includes(String(payload.type)) || !Number.isSafeInteger(payload.tmdbId) || Number(payload.tmdbId) < 1 || (payload.type === "show" && (!Number.isSafeInteger(payload.season) || Number(payload.season) < 0 || !Number.isSafeInteger(payload.episode) || Number(payload.episode) < 1))) return Response.json({ error: "Choose a movie or a valid show episode." }, { status: 400 });
  return relayResponse(request, "/api/resolve-stream", JSON.stringify({ type: payload.type, tmdbId: payload.tmdbId, season: payload.season, episode: payload.episode }));
}
