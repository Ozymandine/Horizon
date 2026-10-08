import "server-only";

import { hasValidSession, SESSION_COOKIE } from "@/lib/auth-session";
import { parsePlaybackIdentity, parsePlaybackSave } from "@/lib/playback-history";
import { getPlaybackHistory, getPlaybackProgress, savePlaybackProgress } from "@/lib/playback-store";

const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
function json(value: unknown, status = 200) { return Response.json(value, { status, headers }); }
function authenticated(request: Request) {
  const secret = process.env.AUTH_SECRET;
  if (!secret) return false;
  const cookie = request.headers.get("cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${SESSION_COOKIE}=`))?.slice(SESSION_COOKIE.length + 1);
  return hasValidSession(cookie, secret);
}
function queryIdentity(request: Request) {
  const params = new URL(request.url).searchParams;
  return parsePlaybackIdentity({ type: params.get("type"), tmdbId: params.get("tmdbId"), ...(params.has("season") ? { season: params.get("season") } : {}), ...(params.has("episode") ? { episode: params.get("episode") } : {}) });
}
export async function playbackProgressGet(request: Request) {
  if (!authenticated(request)) return json({ error: "Please enter the site password." }, 401);
  const identity = queryIdentity(request);
  if (!identity) return json({ error: "Choose a valid movie or episode." }, 400);
  try { return json({ progress: await getPlaybackProgress(identity) }); }
  catch { console.error("[playback] Progress read failed."); return json({ error: "Watch history is temporarily unavailable." }, 503); }
}
export async function playbackProgressPost(request: Request) {
  if (!authenticated(request)) return json({ error: "Please enter the site password." }, 401);
  const origin = request.headers.get("origin");
  if ((origin && origin !== new URL(request.url).origin) || request.headers.get("sec-fetch-site") === "cross-site") return json({ error: "Use Horizon to save watch history." }, 403);
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.startsWith("application/json") && !contentType.startsWith("text/plain")) return json({ error: "Send progress as JSON." }, 415);
  if (Number(request.headers.get("content-length") ?? 0) > 16_384) return json({ error: "Progress payload is too large." }, 413);
  let value: unknown;
  try {
    const reader = request.body?.getReader();
    if (!reader) return json({ error: "Send watch progress." }, 400);
    const chunks: Uint8Array[] = [];
    let length = 0;
    while (true) {
      const { done, value: chunk } = await reader.read();
      if (done) break;
      length += chunk.byteLength;
      if (length > 16_384) { await reader.cancel(); return json({ error: "Progress payload is too large." }, 413); }
      chunks.push(chunk);
    }
    value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch { return json({ error: "Send valid watch progress." }, 400); }
  const input = parsePlaybackSave(value);
  if (!input) return json({ error: "Send valid watch progress and playback timestamps." }, 400);
  try { return json(await savePlaybackProgress(input)); }
  catch { console.error("[playback] Progress save failed."); return json({ error: "Watch history is temporarily unavailable. Your browser keeps a local copy." }, 503); }
}
export async function playbackHistoryGet(request: Request) {
  if (!authenticated(request)) return json({ error: "Please enter the site password." }, 401);
  const params = new URL(request.url).searchParams;
  const type = params.get("type");
  if (type !== "movie" && type !== "show") return json({ error: "Choose movies or shows." }, 400);
  let filter: { tmdbId: number; season: number } | undefined;
  if (params.has("tmdbId") || params.has("season")) {
    const identity = parsePlaybackIdentity({ type, tmdbId: params.get("tmdbId"), season: params.get("season"), episode: 1 }, true);
    if (!identity || type !== "show" || identity.season === undefined) return json({ error: "Choose a valid show and season." }, 400);
    filter = { tmdbId: identity.tmdbId, season: identity.season };
  }
  try { return json({ items: await getPlaybackHistory(type, filter) }); }
  catch { console.error("[playback] History read failed."); return json({ error: "Watch history is temporarily unavailable." }, 503); }
}
