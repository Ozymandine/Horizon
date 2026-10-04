import type { NextRequest } from "next/server";
import { relayResponse } from "@/lib/stream-relay";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token || token.length > 12000 || !/^[A-Za-z0-9_-]+$/.test(token)) return Response.json({ error: "Invalid playback link." }, { status: 400 });
  return relayResponse(request, `/api/proxy-stream?token=${encodeURIComponent(token)}`);
}
