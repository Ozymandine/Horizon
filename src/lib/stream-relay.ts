import "server-only";
import type { NextRequest } from "next/server";
import { hasValidSession, SESSION_COOKIE } from "@/lib/auth-session";

export function privateStreamSession(request: NextRequest) {
  return Boolean(process.env.AUTH_SECRET && hasValidSession(request.cookies.get(SESSION_COOKIE)?.value, process.env.AUTH_SECRET));
}

/** Forward only to the operator's relay, never a browser-supplied host or URL. */
export async function relayResponse(request: NextRequest, path: string, body?: string) {
  if (!privateStreamSession(request)) return Response.json({ error: "Sign in to Horizon to play." }, { status: 401 });
  const base = process.env.STREAM_RELAY_URL;
  const token = process.env.STREAM_RELAY_TOKEN;
  if (!base || !token) return Response.json({ error: "Private playback is not configured on this host. Set up the stream relay using the self-hosting guide." }, { status: 503 });
  let url: URL;
  try {
    const configured = new URL(base);
    if (configured.username || configured.password || configured.pathname !== "/" || configured.search || configured.hash) throw new Error();
    if (configured.protocol !== "https:" && !(configured.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(configured.hostname))) throw new Error();
    url = new URL(path, configured);
  } catch { return Response.json({ error: "The private relay URL must be an HTTPS origin, or local loopback HTTP." }, { status: 503 }); }
  const headers = new Headers({ authorization: `Bearer ${token}` });
  if (body) headers.set("content-type", "application/json");
  if (request.headers.get("range")) headers.set("range", request.headers.get("range")!);
  try {
    const response = await fetch(url, { method: body ? "POST" : "GET", headers, body, redirect: "error", cache: "no-store", signal: AbortSignal.any([request.signal, AbortSignal.timeout(body ? 60_000 : 30_000)]) });
    const output = new Headers({ "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" });
    for (const name of ["content-type", "content-length", "content-range", "accept-ranges"]) {
      const value = response.headers.get(name);
      if (value) output.set(name, value);
    }
    return new Response(response.body, { status: response.status, headers: output });
  } catch { return Response.json({ error: "The private stream relay is unreachable. Check that it is running on the configured host." }, { status: 502 }); }
}
