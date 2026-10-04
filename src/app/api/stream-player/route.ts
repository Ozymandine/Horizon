import type { NextRequest } from "next/server";
import { PLAYER_CSP, PLAYER_HTML } from "@/lib/stream-player";
import { privateStreamSession } from "@/lib/stream-relay";

export const runtime = "nodejs";

export function GET(request: NextRequest) {
  if (!privateStreamSession(request)) return Response.json({ error: "Sign in to Horizon to play." }, { status: 401 });
  return new Response(PLAYER_HTML, { headers: {
    "Content-Type": "text/html; charset=utf-8", "Content-Security-Policy": PLAYER_CSP,
    "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  } });
}
