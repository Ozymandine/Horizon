import { NextRequest, NextResponse } from "next/server";
import { discoveryState } from "@/lib/discovery-options";
import { getDiscoveryProviders } from "@/lib/discovery";

export async function GET(request: NextRequest) {
  const state = discoveryState(request.nextUrl.searchParams);
  if (state.type !== "MOVIE" && state.type !== "SHOW") return NextResponse.json({ providers: [] });
  try {
    return NextResponse.json({ providers: await getDiscoveryProviders(state.type, state.country) }, { headers: { "Cache-Control": "private, max-age=3600" } });
  } catch {
    return NextResponse.json({ error: "Providers are temporarily unavailable.", providers: [] }, { status: 502 });
  }
}
