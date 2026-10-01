import { NextRequest, NextResponse } from "next/server";
import { discoveryState } from "@/lib/discovery-options";
import { getDiscoveryPage } from "@/lib/discovery";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const rawType = params.get("type");
  if (rawType !== "MOVIE" && rawType !== "SHOW" && rawType !== "GAME" && rawType !== "MUSIC") {
    return NextResponse.json({ error: "Choose a media category to explore." }, { status: 400 });
  }
  try {
    return NextResponse.json(await getDiscoveryPage(discoveryState(params), Number(params.get("page") ?? 1)), { headers: { "Cache-Control": "private, max-age=60" } });
  } catch {
    return NextResponse.json({ error: "The catalog is unavailable right now." }, { status: 502 });
  }
}
